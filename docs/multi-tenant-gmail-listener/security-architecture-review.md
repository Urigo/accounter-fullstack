# Security & Architecture Review — Multi-tenant Email Ingestion (S01–S20)

**Reviewer focus:** exploits/backdoors/vulnerabilities across the full email flow, architecture,
best practices, untested edge cases, alignment with the plan. **Branch reviewed:**
`multi-tenant-gmail-listener` @ `ac7b8e6` (after S20 / PR #3719 merge). **Scope:** All steps S01–S20
— gateway package, server `email-ingestion` module, gateway-control-plane auth, and migrations.

---

## Executive summary

The cryptographic perimeter (HMAC authenticity, single-use message-bound grants, timing-safe
control-plane token) is well built, and the legacy listener path is safely preserved for rollback.

However, stepping back across **all** steps, three independent gaps line up into one conclusion:
**the v2 path cannot run a real message end-to-end**, and the layer of DB isolation the docs claim
is not actually wired. None of this is a remote exploit or backdoor — tenant isolation still holds
via explicit `owner_id` filters plus message-bound single-use grants — but the risk is
**operational/architectural**: the work reads as production-ready (green CI, runbook, release
checklist) while being an incomplete pipeline.

The three structural gaps:

1. **No way to populate alias routing** — the S07 table is read-only in code (no insert/seed/admin
   path).
2. **The gateway never receives or parses MIME** — `extractedDocuments` is always `[]`, so S17 is
   dead code.
3. **Live ingest writes bypass the S13.6 tenant-aware/RLS hardening** — the hardened provider is
   orphaned.

Each is individually "merged and green" because the test suites assert the partial behavior (e.g.
the integration test expects `QUARANTINED / NO_DOCUMENTS` as the success outcome).

---

## Findings by severity

### 🔴 HIGH

#### H1 — The live path can never ingest a document (S17 extraction is dead code)

- **Where:** `packages/email-ingestion-gateway/src/webhook.ts:163` hardcodes
  `extractedDocuments: []`.
- **Detail:** `extractFromMime` / `buildSenderEvidence` (S17) have **zero non-test callers**. The
  webhook receives only JSON metadata (`recipientAlias`, `messageId`, `rawMessageHash`) — never the
  raw MIME — so it has nothing to parse.
- **Consequence:** Every real message reaches `email-ingestion-ingest.provider.ts:235` →
  `QUARANTINED / NO_DOCUMENTS`. The integration test (`integration.test.ts:197`) actually _asserts_
  `QUARANTINED/NO_DOCUMENTS` as the happy-path result, so the broken behavior is encoded as
  expected.
- **Also:** `rawMessageHash` is sender-asserted and never verified against content (neither gateway
  nor server ever sees the bytes). Architecture-plan steps 4 & 7 ("Gateway computes
  raw_message_hash" / "parses MIME and extracts documents") are unimplemented.
- **Fix:** Either forward the raw MIME from the Cloudflare Worker and wire `extractFromMime`
  (recomputing the hash in the gateway), or formally descope extraction and update plan + tests so
  the happy path isn't `NO_DOCUMENTS`.

#### H2 — S13.6 tenant-aware DB hardening is orphaned (RLS not enforced on live writes)

- **Where:** `EmailIngestionIdempotencyProvider` (Scope.Operation + `TenantAwareDBClient`) is
  registered in `email-ingestion/index.ts` but **its methods are never called**. Only the pure
  `computeDedupFingerprint` function is reused.
- **Detail:** The live path `EmailIngestionIngestProvider.performIngest()` runs **all**
  idempotency/dedup/quarantine SQL directly on `this.dbProvider.pool` — the raw pool that
  `db.provider.ts` documents as bypassing RLS (BYPASSRLS role).
- **Consequence:** The `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policies on
  `email_ingestion_idempotency_keys` / `dedup_fingerprints` / `grants` are **not in effect for any
  live write**. Tenant isolation rests solely on the explicit `owner_id = $tenantId` filters in
  application SQL. The S20 release-checklist claims these go through `TenantAwareDBClient` with "RLS
  WITH CHECK as defense-in-depth" — that is the design intent but **not the actual wiring**.
- **Exploitability:** Not currently exploitable (filters are correct; `tenantId` derives from a
  validated, message-bound grant), but the second defense layer the plan calls for is absent, and
  there is orphaned code that S20 was supposed to rule out.
- **Fix:** Route live ingest writes through
  `EmailIngestionIdempotencyProvider`/`TenantAwareDBClient`, or delete the orphaned provider and
  correct the S20 audit doc to state isolation is enforced by explicit `owner_id` filters on a
  BYPASSRLS pool.

#### H3 — No alias provisioning path (multi-tenancy unreachable end-to-end)

- **Where:** `email_ingestion_alias_routing` is only ever read (`getAliasByAlias` in
  `email-ingestion-control.provider.ts`).
- **Detail:** No mutation, seed, bootstrap, or admin path inserts an alias→owner row anywhere in
  `packages/server/src`.
- **Consequence:** Even with H1 fixed, there is no supported way to onboard a tenant alias except
  hand-written SQL. The routing table that is the project's entire purpose cannot be populated
  through the app.
- **Fix:** Add an admin/super-admin mutation (or seed/bootstrap step) to manage alias→owner rows,
  with appropriate auth.

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

- **Where:** `orchestrator.ts` uses `messageId` as the idempotency key; the documented Worker
  derives `messageId` from the email `Message-ID` header.
- **Consequence:** A party who can email a tenant alias could pre-seed a `Message-ID` so a later
  legitimate message collapses to `DUPLICATE` and is silently dropped (data-suppression). Also trips
  innocently on bulk senders that reuse Message-IDs.
- **Fix:** Key idempotency on `rawMessageHash` or a server-generated key rather than the
  sender-controlled `Message-ID`.

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
  RLS — moot today only because the table is unused.
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

#### L4 — Contracts parity is test-enforced only

- `contracts.ts` is duplicated in server and gateway (correctly, no runtime import), but a one-sided
  reason-code addition won't fail to compile — only the parallel tests guard it.

#### L5 — Logger has no redaction layer

- `logger.ts` does not redact, but no secret/signature/token is ever passed to it in practice (only
  reason/outcome/ids). Low risk; consider a redaction allowlist if fields expand later.

---

## What is solid (do not regress)

- **HMAC verification ordering:** verify-before-trust — body read with a hard size cap, signature
  verified, _then_ JSON parsed (`webhook.ts:101→118`). Signature compare is timing-safe with a
  length pre-check.
- **Grant model:** globally-unique `jti`, atomic consume-once
  (`UPDATE … WHERE consumed_at IS NULL` + rowcount check), bound to tenant + message + hash +
  action + expiry (`email-ingestion-control.provider.ts:163-212`). Cross-tenant reuse correctly
  returns `TENANT_MISMATCH`.
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

- Happy path with **actual extracted documents** (`INSERTED`) — currently impossible to test because
  extraction is unwired; the suite asserts `QUARANTINED/NO_DOCUMENTS` instead.
- `rawMessageHash` mismatch between control and ingest (grant hash-binding rejection) on the live
  wire.
- Nonce replay **across process restart / multiple instances** (in-memory store limitation).
- `messageId` collision causing legitimate-message suppression (M2).
- Alias resolution for an **inactive** alias (`is_active = FALSE`) end-to-end.
- IPv6 source address against an IP allowlist (L2).
- Empty/missing `CF_WEBHOOK_SECRET` behavior in non-production (L1).

---

## Alignment with the plan (`architecture-plan.md`)

| Plan item                                                     | Status                                              |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Cloudflare authenticity (HMAC) primary control                | ✅ Implemented                                      |
| IP allowlist as defense-in-depth                              | ⚠️ IPv4-only (L2)                                   |
| Single-use, message-bound grants                              | ✅ Implemented                                      |
| Idempotent retries return prior result                        | ✅ Implemented (keyed on sender-controlled id — M2) |
| Quarantine persisted 30 days                                  | ⚠️ Table exists; no retention job (M4)              |
| Gateway computes raw_message_hash                             | ❌ Trusts sender-asserted hash (H1)                 |
| Gateway parses MIME, extracts documents + sender evidence     | ❌ Dead code; always `[]` (H1)                      |
| Tenant resolution authoritative in server                     | ✅ Yes (but no provisioning path — H3)              |
| Tenant-bound writes via Scope.Operation + TenantAwareDBClient | ❌ Orphaned; live path uses raw pool (H2)           |
| Replay nonce uniqueness in cache window                       | ⚠️ In-memory only; persisted table unused (M1)      |
| No direct DB writes from gateway                              | ✅ Yes                                              |
| No runtime code sharing legacy ↔ gateway                      | ✅ Yes                                              |
| Correlation_id propagated end-to-end                          | ✅ Yes                                              |
| Shadow mode for parity validation                             | ✅ Implemented                                      |

---

## Recommended priority order

1. **H1** — resolve the extraction gap (forward raw MIME + wire `extractFromMime`, or descope and
   fix plan/tests).
2. **H3** — add an alias provisioning mutation/seed so tenants can actually be onboarded.
3. **H2** — route live ingest writes through the tenant-aware client, or delete the orphaned
   provider and correct the S20 audit doc.
4. **M1 / M2 / M3 / M4** — persist nonces, re-key idempotency, wire or drop server flags, add
   retention jobs.
5. **M5 / M6 / L1–L5** — observability accuracy, RLS policy clarity, secret/readiness hardening.

> Note: all findings are on already-merged code; no code was modified during this review.
