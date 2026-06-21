# Security & Architecture Review — Multi-tenant Email Ingestion (S01–S20)

**Reviewer focus:** exploits/backdoors/vulnerabilities across the full email flow, architecture,
best practices, untested edge cases, alignment with the plan. **Scope:** All steps S01–S20 — gateway
package, server `email-ingestion` module, gateway-control-plane auth, and migrations. **Status:**
Living document. H1–H3 and M2 have been fixed on branch `claude/email-ingestion-security-review`;
resolved findings are marked ✅ inline and new findings are folded into the sections below.
Remaining work is medium/low hardening.

---

## Executive summary

The cryptographic perimeter (HMAC authenticity, single-use message-bound grants, timing-safe
control-plane token) is well built, and the legacy listener path is safely preserved for rollback.

The v2 pipeline now runs end-to-end: the gateway receives the raw MIME, computes the authoritative
content hash, extracts documents, and forwards them (H1); tenants can be onboarded through
alias-provisioning mutations (H3); the live ingest writes run under the grant-validated tenant's RLS
context (H2); and idempotency keys are content-derived rather than sender-controlled (M2). Tenant
isolation holds via explicit `owner_id` filters plus message-bound single-use grants, now backed by
RLS WITH CHECK on the live writes.

What remains is **medium/low operational hardening** — persistent replay nonces, retention jobs,
server-side feature-flag wiring, observability accuracy, RLS-policy clarity on the alias/nonce
tables, and a now-live MIME parser that should get fuzz coverage.

---

## Findings by severity

### 🔴 HIGH

#### H1 — The live path can never ingest a document (S17 extraction is dead code)

- **Where:** `packages/email-ingestion-gateway/src/webhook.ts:163` hardcoded
  `extractedDocuments: []`.
- **Detail:** `extractFromMime` / `buildSenderEvidence` (S17) had **zero non-test callers**. The
  webhook received only JSON metadata (`recipientAlias`, `messageId`, `rawMessageHash`) — never the
  raw MIME — so it had nothing to parse, and `rawMessageHash` was sender-asserted, never verified
  against content.
- **Consequence:** Every real message reached `QUARANTINED / NO_DOCUMENTS`; the integration test
  even asserted that as the happy path.
- **✅ Resolved (this branch + #3730/#3728/#3735):** The gateway now receives the raw MIME as the
  request body (routing metadata in `x-cf-*` headers), computes the authoritative SHA-256 itself
  ([webhook.ts:142](../../packages/email-ingestion-gateway/src/webhook.ts#L142)), runs
  `extractFromMime`, and forwards the extracted documents. A new Cloudflare
  [worker.ts](../../packages/email-ingestion-gateway/src/worker.ts) sends the raw MIME signed over
  `${timestamp}.${rawBody}`. Happy path is now `INSERTED`, proven by a PDF-extraction e2e test. Plan
  items 4 & 7 are implemented. (Two parser bugs were fixed in passing — a multipart boundary-prefix
  collision that dropped attachments and an out-of-bounds read at buffer end — and a quarantine RLS
  policy leak that let every tenant read orphaned `tenant_candidate IS NULL` rows.)

#### H2 — S13.6 tenant-aware DB hardening is orphaned (RLS not enforced on live writes)

- **Where:** `EmailIngestionIngestProvider.performIngest()` ran **all** idempotency/dedup/quarantine
  SQL directly on `this.dbProvider.pool` (the raw, RLS-bypassing pool). The hardened
  `EmailIngestionIdempotencyProvider` (Scope.Operation + `TenantAwareDBClient`) was registered but
  **never called**.
- **Consequence:** The `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policies on the ingest tables
  were not in effect for any live write; isolation rested solely on explicit `owner_id = $tenantId`
  filters. The S20 release-checklist claimed `TenantAwareDBClient` with "RLS WITH CHECK as
  defense-in-depth" — design intent, not actual wiring.
- **✅ Resolved (this branch):** `performIngest()` now runs steps 2–5 inside one transaction whose
  `app.current_business_id` is pinned (`set_config(..., true)` / SET LOCAL) to the
  **grant-validated** tenant — not the empty control-plane auth session — so
  `get_current_business_id()` resolves to the tenant and the `tenant_isolation` WITH CHECK policies
  enforce `owner_id = tenantId` as defense-in-depth (the writes are now atomic, too). The orphaned
  `EmailIngestionIdempotencyProvider` (whose `TenantAwareDBClient` design cannot serve the
  empty-businessId control-plane caller) was **deleted**; its pure `computeDedupFingerprint` moved
  to `email-ingestion-dedup.ts`.
- **Caveat:** Actual RLS enforcement still depends on the production DB role not holding `BYPASSRLS`
  — the same dependency the app-wide `TenantAwareDBClient` model already relies on. The S20 audit
  doc should be reconciled to describe this grant-tenant wiring.

#### H3 — No alias provisioning path (multi-tenancy unreachable end-to-end)

- **Where:** `email_ingestion_alias_routing` was only ever read (`getAliasByAlias`); no mutation,
  seed, or admin path inserted an alias→owner row anywhere in `packages/server/src`.
- **Consequence:** Even with H1 fixed, there was no supported way to onboard a tenant alias except
  hand-written SQL.
- **✅ Resolved (this branch):** Added `createEmailIngestionAlias` / `setEmailIngestionAliasActive`
  mutations + an `emailIngestionAliases` query (`business_owner`-gated), backed by
  `EmailIngestionAliasProvider`. Writes go through `TenantAwareDBClient` (the
  `tenant_isolation_write` RLS policy enforced as defense-in-depth) plus a
  `ScopeProvider.resolveWriteTarget` membership check; the global partial-unique index surfaces
  cross-tenant alias collisions as a generic "already in use" conflict without leaking ownership.

### 🟡 MEDIUM

#### M1 — In-memory nonce store only; persisted replay table (S09) unused

- **Where:** `index.ts:23` builds the verifier with the default `MemoryNonceStore`; the
  `email_ingestion_replay_nonces` table is never used at runtime.
- **Consequence:** Replay protection is per-process — it evaporates on restart and does not hold
  across horizontally-scaled instances. Grant single-use + idempotency are the real backstop, so
  impact is limited, but the documented persistent replay cache is not actually used.
- **Fix:** Back the nonce store with the persisted table (or document the in-memory limitation and
  pin to a single instance).

#### M2 — `idempotencyKey = messageId`, and `messageId` is sender-controlled

- **Where:** `orchestrator.ts` used `messageId` (derived from the email `Message-ID` header) as the
  idempotency key.
- **Consequence:** A party who can email a tenant alias could pre-seed a `Message-ID` so a later
  legitimate message collapses to `DUPLICATE` and is silently dropped (data-suppression); also trips
  on bulk senders that reuse Message-IDs.
- **✅ Resolved (this branch):** `orchestrator.ts` now keys idempotency on the gateway-computed
  `rawMessageHash` (content-derived and authoritative, available since H1) rather than the
  sender-controlled `Message-ID`, closing the data-suppression vector. The grant remains bound to
  `messageId` + `rawMessageHash` separately.

#### M3 — Server feature flags (S03) are dead

- **Where:** `packages/server/src/environment.ts:300-301` parses `EMAIL_INGESTION_V2_ENABLED` /
  `EMAIL_INGESTION_SHADOW_MODE`, but nothing in the server reads them.
- **Consequence:** `requestIngestControl` / `ingestEmail` are gated only by role, not by the flag.
  The implied server-side kill-switch does not exist; disabling v2 on the server has no effect (only
  the gateway flag gates). The rollback runbook implies a server lever that isn't real.
- **Fix:** Wire the flag into the resolvers, or drop it and document that the gateway flag is the
  sole switch.

#### M4 — No retention/cleanup for any table

- **Where:** No purge job for `email_ingestion_quarantine`, `_grants`, `_idempotency_keys`,
  `_dedup_fingerprints`, or `_replay_nonces`.
- **Detail:** Plan says quarantine retention = 30 days. `grants.expires_at` has an index "for
  expiry-based cleanup" but nothing runs it.
- **Consequence:** Tables grow unbounded; stated retention policy is not enforced.
- **Fix:** Add a scheduled cleanup job (the repo already has a `corn-jobs` module to host it).

#### M5 — Control errors all map to `UNKNOWN_ALIAS`

- **Where:** `server-client.ts:169-174` labels any `CommonError` from the control mutation as
  `UNKNOWN_ALIAS`.
- **Consequence:** Other server-side control failures are masked in logs/metrics, undermining the
  S19 observability goals (alerting on UNKNOWN_ALIAS spikes becomes noisy/misleading).
- **Fix:** Propagate a distinct reason/`reasonCode` from the server `CommonError` instead of
  assuming unknown alias.

#### M6 — RLS policy intent is easy to misread on alias/nonce tables

- **Where:** `alias_routing` and `replay_nonces` declare a `FOR ALL` write policy plus a
  `FOR SELECT USING(TRUE)` policy; permissive policies are OR-combined, so reads are effectively
  open (the intended result).
- **Detail:** `replay_nonces.owner_id` is nullable but the `FOR ALL` write policy requires
  `owner_id = get_current_business_id()`, so a pre-tenant nonce insert would fail `WITH CHECK` under
  RLS — moot today only because the table is unused. (The analogous NULL-row gap on the _quarantine_
  table was already fixed under H1.)
- **Fix:** Split into explicit `FOR SELECT` and `FOR INSERT/UPDATE/DELETE` policies and reconcile
  the nullable `owner_id`.

### 🟢 LOW / NOTES

#### L1 — Empty `CF_WEBHOOK_SECRET` outside production = no authentication

- `index.ts:13` only hard-fails when `NODE_ENV === 'production'`. With an empty secret, the HMAC
  uses an empty (publicly known) key and the default IP allowlist is also empty — staging can be
  wide open.
- **Fix:** Fail fast whenever `v2Enabled` regardless of `NODE_ENV`, or reject empty-secret
  verification inside the verifier.

#### L2 — IP allowlist is IPv4-only

- `verifier.ts` `matchesIpv4Cidr` cannot match IPv6 CIDRs; an IPv6 Cloudflare egress would be
  silently rejected. Acceptable as defense-in-depth today, but document it.

#### L3 — `/readiness` always returns `{ ready: true }`

- `index.ts:44` does no server-connectivity check, so it cannot gate traffic during a server outage.
  Partially mitigated operationally: the worker probes `/health` _before_ consuming `message.raw`
  and falls back to `message.forward(FALLBACK_EMAIL)` if the gateway is unreachable.

#### L4 — Contracts parity is test-enforced only

- `contracts.ts` is duplicated in server and gateway (correctly, no runtime import), but a one-sided
  reason-code addition won't fail to compile — only the parallel tests guard it.

#### L5 — Logger has no redaction layer

- `logger.ts` does not redact, but no secret/signature/token is ever passed to it in practice (only
  reason/outcome/ids). Low risk; consider a redaction allowlist if fields expand later.

#### N1 — The MIME parser is now a live attack surface

- With extraction wired (H1), `extractFromMime` parses authenticated-but-attacker-influenced content
  (any party can email a tenant alias; HMAC only proves the bytes came _through_ the Cloudflare
  worker, not that they are benign). It is reasonably bounded already — `MAX_RAW_MIME_BYTES` 25 MB,
  `MAX_ATTACHMENT_COUNT` 10, `MAX_EXTRACTED_BYTES` 20 MB, `MAX_MIME_DEPTH` 10 — and
  verify-before-trust ordering is intact (parsing runs only after `verdict.valid`).
- **Fix:** Add fuzz tests for the parser now that it sits on untrusted input.

#### N2 — Worker health-probe TOCTOU

- `worker.ts` health-checks `/health`, then reads `message.raw` (which makes `message.forward()`
  impossible), then POSTs. If the gateway dies between probe and POST, the message is lost and the
  worker throws — there is no second fallback. Documented tradeoff, but worth an operational note
  since email-worker retry semantics are limited.

#### N3 — Body cap widened 1 MiB → 25 MB

- `MAX_BODY_BYTES` is now `MAX_RAW_MIME_BYTES` (25 MB), since the body is the full raw MIME rather
  than small JSON metadata. Bounded and intentional; just a larger memory envelope per request
  (buffered in both worker and gateway).

---

## What is solid (do not regress)

- **HMAC verification ordering:** verify-before-trust — body read with a hard size cap, signature
  verified, _then_ the MIME is parsed/extracted (`webhook.ts` steps 3→4→5). Signature compare is
  timing-safe with a length pre-check.
- **Gateway owns the content hash:** `rawMessageHash` is computed from the signed body in the
  gateway, not sender-asserted, and idempotency is keyed on it.
- **Grant model:** globally-unique `jti`, atomic consume-once
  (`UPDATE … WHERE consumed_at IS NULL` + rowcount check), bound to tenant + message + hash +
  action + expiry (`email-ingestion-control.provider.ts:163-212`). Cross-tenant reuse correctly
  returns `TENANT_MISMATCH`.
- **Live ingest writes:** run in one transaction under the grant-validated tenant's RLS context, so
  the `tenant_isolation` WITH CHECK policies apply as defense-in-depth alongside explicit `owner_id`
  filters.
- **Gateway-control-plane auth:** timing-safe hashed comparison, empty `businessId` so
  `TenantAwareDBClient` can't be abused, rejects when token unconfigured
  (`auth-context.provider.ts:319-375`).
- **Legacy compat / rollback:** `gmail-listener` server module is a pure re-export shim;
  `insertEmailDocuments` still works end-to-end through the `email-ingestion` module. Legacy
  single-tenant behavior preserved.
- **Anti-coupling:** no runtime imports from `packages/gmail-listener` into the gateway.
- **Migrations:** case-insensitive partial-unique alias index (`WHERE is_active = TRUE`),
  global-unique `jti`/`nonce`, tenant-scoped unique idempotency/dedup, `ON DELETE CASCADE` to
  `businesses`, sensible triage indexes.

---

## Edge cases lacking test coverage

- `rawMessageHash` mismatch between control and ingest (grant hash-binding rejection) on the live
  wire.
- Nonce replay **across process restart / multiple instances** (in-memory store limitation — M1).
- Alias resolution for an **inactive** alias (`is_active = FALSE`) end-to-end.
- IPv6 source address against an IP allowlist (L2).
- Empty/missing `CF_WEBHOOK_SECRET` behavior in non-production (L1).
- Malformed/adversarial MIME against the now-live parser (N1).

---

## Alignment with the plan (`architecture-plan.md`)

| Plan item                                                 | Status                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Cloudflare authenticity (HMAC) primary control            | ✅ Implemented                                                    |
| IP allowlist as defense-in-depth                          | ⚠️ IPv4-only (L2)                                                 |
| Single-use, message-bound grants                          | ✅ Implemented                                                    |
| Idempotent retries return prior result                    | ✅ Implemented (keyed on content-derived `rawMessageHash`)        |
| Quarantine persisted 30 days                              | ⚠️ Table exists; no retention job (M4)                            |
| Gateway computes raw_message_hash                         | ✅ Implemented                                                    |
| Gateway parses MIME, extracts documents + sender evidence | ✅ Implemented                                                    |
| Tenant resolution authoritative in server                 | ✅ Implemented (provisioning via alias mutations)                 |
| Tenant-bound writes under tenant RLS context              | ✅ Live writes pinned to the grant-validated tenant's RLS context |
| Replay nonce uniqueness in cache window                   | ⚠️ In-memory only; persisted table unused (M1)                    |
| No direct DB writes from gateway                          | ✅ Yes                                                            |
| No runtime code sharing legacy ↔ gateway                  | ✅ Yes                                                            |
| Correlation_id propagated end-to-end                      | ✅ Yes                                                            |
| Shadow mode for parity validation                         | ✅ Implemented                                                    |

---

## Recommended priority order

1. **M1 / M3 / M4** — persist nonces, wire or drop server flags, add retention jobs.
2. **M5 / M6** — observability accuracy (distinct control reason codes), RLS-policy clarity on the
   alias/nonce tables.
3. **N1** — fuzz the now-live MIME parser.
4. **L1–L5 / N2 / N3** — secret/readiness hardening, IPv6 allowlist, logger redaction, worker TOCTOU
   note, body-cap memory envelope.

> H1–H3 and M2 were fixed on branch `claude/email-ingestion-security-review`. This is a living
> document: resolved findings are marked ✅ inline and new findings (N1–N3) are folded into the
> sections above; remaining findings are open.
