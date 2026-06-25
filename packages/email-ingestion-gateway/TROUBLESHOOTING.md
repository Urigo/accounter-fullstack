# Troubleshooting: why an email didn't become a document

This guide helps developers and operators diagnose why an inbound email **failed to insert**, was
**quarantined**, **rejected**, or silently treated as a **duplicate**. It covers the full v2 path:
Cloudflare Worker → gateway service → Accounter server.

Work top-to-bottom: an email passes through stages, and each stage can stop it. Identify the **last
log line you can find** for the message and jump to that stage.

---

## 0. The single most useful key: `correlationId`

Every request is stamped with a `correlationId` (the `x-correlation-id` header, or a generated
UUID). It appears in:

- Every gateway log line (`src/logger.ts` emits structured JSON with `correlationId`).
- The `X-Correlation-Id` response header.
- The server's `email_ingestion_quarantine.correlation_id` and
  `email_ingestion_dedup_fingerprints.correlation_id` columns.

**Always start by grabbing the correlationId** (from the Worker logs, the `/webhook` response
header, or the quarantine row) and grepping every log/table by it.

The other durable identifiers:

- `rawMessageHash` — SHA-256 of the raw MIME, computed by the gateway. This is the idempotency key
  and the dedup input. Same content ⇒ same hash.
- `messageId` — the upstream `Message-ID`. Bound into the grant; **not** used for dedup.
- `auditId` — returned on every ingest outcome for cross-referencing.

---

## 1. Outcome & reason-code reference

Outcomes (`IngestOutcome`) and reason codes (`IngestReasonCode`) are defined **twice** — once in the
gateway (`src/contracts.ts`) and once in the server
(`packages/server/src/modules/email-ingestion/contracts.ts`). They are intentionally duplicated (no
cross-package runtime import) and kept in sync by parity tests.

### Outcomes

| Outcome       | Meaning                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `INSERTED`    | A charge + document(s) were persisted under the recognized business.                      |
| `DUPLICATE`   | Idempotency key or dedup fingerprint already seen — returns the prior `existingIngestId`. |
| `QUARANTINED` | Accepted and audited but **not** inserted — needs triage (see quarantine table).          |
| `REJECTED`    | Grant validation failed; nothing persisted, nothing quarantined.                          |

### Reason codes — where each is produced

| Reason code          | Stage / file                              | What happened                                                                     |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `INVALID_AUTH`       | gateway `verifier.ts`                     | IP not allowlisted, timestamp outside ±300s, or bad HMAC signature. → `401`.      |
| `REPLAY_DETECTED`    | gateway `verifier.ts`                     | Nonce already seen within the retention window (default 600s). → `401`.           |
| `OVERSIZE_MESSAGE`   | gateway `mime-extractor.ts`               | Raw MIME > 25 MB, > 10 attachments, or extracted bytes > 20 MB.                   |
| `PARSE_ERROR`        | gateway `mime-extractor.ts`               | Empty body or `postal-mime` failed (e.g. nesting depth > 10).                     |
| `UNKNOWN_ALIAS`      | server `email-ingestion-control.provider` | `recipientAlias` does not resolve to an active tenant alias.                      |
| `TIMEOUT`            | gateway `server-client.ts`                | Control (3s) or ingest (10s) call timed out after retries.                        |
| `TRANSIENT_UPSTREAM` | gateway `server-client.ts`                | Server returned 5xx / network error after retries, or empty response.             |
| `GRANT_INVALID`      | server `email-ingestion-control.provider` | Grant missing, expired, already consumed, wrong action, or message/hash mismatch. |
| `TENANT_MISMATCH`    | server `email-ingestion-control.provider` | Grant's `owner_id` ≠ the claimed `tenantId`.                                      |
| `NO_DOCUMENTS`       | server `email-ingestion-ingest.provider`  | After treatment, the document set was empty. **Most common quarantine reason.**   |

---

## 2. Stage-by-stage diagnosis

### Stage A — the email never reached the gateway

Symptom: no gateway log line for the message at all.

- **Worker fell back to forwarding.** `src/worker.ts` probes `GET /health` before consuming the
  stream; if the gateway is unreachable it calls `message.forward(FALLBACK_EMAIL)` and the email
  goes to the legacy mailbox instead. Check Worker logs for `Gateway unreachable` and verify
  `GATEWAY_URL` + gateway health.
- **Feature flag off.** If `EMAIL_INGESTION_V2_ENABLED=0`, `/webhook` returns `503` immediately
  (`webhook.ts` step 1). Look for a `503` in the gateway access logs.
- **Cloudflare routing.** The alias may not be routed to the Worker at all. See the
  [cloudflare-setup-runbook](../../docs/multi-tenant-gmail-listener/cloudflare-setup-runbook.md).

### Stage B — authenticity rejected (`401`, `INVALID_AUTH` / `REPLAY_DETECTED`)

Gateway log: `webhook authenticity check failed` with `reason`.

Checklist (`src/verifier.ts`, order of checks):

1. **IP allowlist** — only enforced when `CF_IP_ALLOWLIST` is non-empty. A misconfigured allowlist
   (or Cloudflare IP change) rejects everything. Confirm the source IP (`cf-connecting-ip` /
   `x-forwarded-for`) is covered.
2. **Timestamp window** — `|now − x-cf-timestamp| ≤ 300s`. Clock skew between Worker and gateway, or
   a replayed-but-stale request, fails here. Note the timestamp is in **seconds**, not ms.
3. **HMAC signature** — `CF_WEBHOOK_SECRET` must be **identical** on the Worker and the gateway. A
   mismatched secret is the #1 cause. The signature is hex HMAC-SHA256 of
   `` `${timestamp}.${rawBody}` ``; if a proxy mutates the body, the signature breaks.
4. **Nonce replay** — a re-sent request with the same `x-cf-nonce` within 600s yields
   `REPLAY_DETECTED`. The nonce store is **in-memory** (`MemoryNonceStore`), so a gateway restart
   clears it — legitimate retries after a restart are fine; a genuinely duplicated delivery is not.

> Verification order matters: the nonce is only stored **after** the signature is verified, so
> forged requests can't pollute the replay store.

### Stage C — MIME parse / size failure (`PARSE_ERROR`, `OVERSIZE_MESSAGE`)

Gateway log: `webhook: MIME extraction failed` with `reason`.

- `src/mime-extractor.ts` enforces: `MAX_RAW_MIME_BYTES` (25 MB), `MAX_ATTACHMENT_COUNT` (10),
  `MAX_EXTRACTED_BYTES` (20 MB), `MAX_MIME_DEPTH` (10).
- **Important:** extraction failure does **not** stop the pipeline. The gateway still calls
  orchestration with an empty document set so the server records an auditable quarantine
  (`NO_DOCUMENTS`). So a `PARSE_ERROR` email typically surfaces as a `NO_DOCUMENTS` quarantine row
  on the server side, with the gateway log showing the real `PARSE_ERROR`/`OVERSIZE` cause. **Check
  gateway logs, not just the quarantine table, to learn why it was empty.**
- Document detection is selective: only PDF and common image types (PNG/JPEG/GIF/TIFF/BMP/WebP),
  plus `application/octet-stream` with a `.pdf` filename, count as documents. A spreadsheet or
  `.docx` attachment is **ignored** and won't produce a document on its own.

### Stage D — control / tenant resolution (`UNKNOWN_ALIAS`)

Gateway logs: `orchestrate:control:start` then either `orchestrate:control:granted` or
`orchestrate:control:denied`.

- `UNKNOWN_ALIAS` ⇒ the `recipientAlias` has no **active** row in
  `accounter_schema.email_ingestion_alias_routing`. Alias match is case-insensitive on
  `lower(alias)`, and only `is_active = TRUE` rows resolve.

  ```sql
  SELECT id, alias, owner_id, is_active
  FROM accounter_schema.email_ingestion_alias_routing
  WHERE lower(alias) = lower('invoices@acme.example.com');
  ```

  Fix by provisioning/activating an alias (`createEmailIngestionAlias` /
  `setEmailIngestionAliasActive` mutations, `business_owner` role).

- **Business not recognized** is _not_ an error. If sender evidence matches no business,
  `businessEmailConfig` is `null` and the gateway applies **default treatment** (body→PDF). The
  document is still inserted, just without a counterparty business attached. To make recognition
  work, the sender address must appear in the target business's `suggestion_data->'emails'`.

### Stage E — treatment produced no documents (→ `NO_DOCUMENTS`)

Gateway log: `orchestrate:treatment:complete` with `documentCount`. If `documentCount: 0`, the
server will quarantine `NO_DOCUMENTS`.

Treatment (`src/treatment.ts`) assembles the final set from three sources:

1. **Attachments**, filtered by `config.attachments` (an allowlist of `PDF`/`PNG`/`JPEG`). If the
   business config allowlists only `PDF` and the mail carries a PNG, the PNG is dropped.
2. **Body → PDF**, only when **no business is recognized** _or_ `config.emailBody === true`, and the
   body is non-empty. Render failures are logged (`treatment: body→PDF render failed`) and the body
   document is omitted — check for a missing/broken Chromium in the runtime.
3. **Internal-link documents**, fetched for each configured `config.internalEmailLinks` pattern
   found in the body. Failures log `treatment: internal-link fetch failed`. Note the SSRF guards in
   `src/link-fetcher.ts` will silently return `[]` if the link host isn't allowlisted, resolves to a
   private IP, redirects, has a disallowed content-type, or exceeds the size cap.

So a `NO_DOCUMENTS` quarantine means: no qualifying attachment **and** body→PDF didn't run/failed
**and** no internal-link document was fetched.

### Stage F — grant validation on ingest (`REJECTED`: `GRANT_INVALID` / `TENANT_MISMATCH`)

Gateway log: `orchestrate:ingest:failed`. Server side: `email-ingestion-control.provider.ts`
`validateAndConsumeGrant`.

A grant (`accounter_schema.email_ingestion_grants`) is single-use and short-lived (TTL 5 min). It is
`REJECTED` if it is:

- missing (wrong/typo'd `jti`),
- already `consumed_at` (a retry of an already-completed ingest — the atomic consume-once UPDATE
  returns 0 rows),
- past `expires_at` (slow pipeline between control and ingest),
- wrong `action` (not `ingest`),
- bound to a different `message_id` or `raw_message_hash` than presented (`GRANT_INVALID`), or
- owned by a different tenant than claimed (`TENANT_MISMATCH`).

```sql
SELECT jti, owner_id, message_id, action, expires_at, consumed_at
FROM accounter_schema.email_ingestion_grants
WHERE jti = '<grantJti>';
```

### Stage G — duplicate suppression (`DUPLICATE`)

Server: `email-ingestion-ingest.provider.ts`. Two independent checks, both tenant-scoped:

1. **Idempotency key** (`email_ingestion_idempotency_keys`) — keyed on `(idempotency_key, owner_id)`
   where `idempotency_key = rawMessageHash`. A re-delivery of the exact same bytes returns the prior
   outcome.
2. **Dedup fingerprint** (`email_ingestion_dedup_fingerprints`) — keyed on `(owner_id, fingerprint)`
   where `fingerprint = computeDedupFingerprint(tenantId, rawMessageHash)`. Catches re-delivery even
   if the gateway supplied a different idempotency key.

If a legitimately-new email is being swallowed as a duplicate, confirm its `rawMessageHash` actually
differs:

```sql
SELECT idempotency_key, outcome, ingest_id, created_at
FROM accounter_schema.email_ingestion_idempotency_keys
WHERE owner_id = '<tenantId>' AND idempotency_key = '<rawMessageHash>';

SELECT fingerprint, outcome, ingest_id, correlation_id, created_at
FROM accounter_schema.email_ingestion_dedup_fingerprints
WHERE owner_id = '<tenantId>';
```

### Stage H — inserted but "missing" in the UI

Gateway log: `orchestrate:ingest:complete` with `outcome: INSERTED` and an `ingestId`.

- The `ingestId` **is the created charge id**. Look the charge up directly:

  ```sql
  SELECT id, owner_id, user_description, created_at
  FROM accounter_schema.charges
  WHERE id = '<ingestId>';
  ```

- Documents are inserted with `remarks` containing `email-ingestion: <messageId>` — useful for
  finding all documents from a given email:

  ```sql
  SELECT id, charge_id, type, file_hash, remarks
  FROM accounter_schema.documents
  WHERE owner_id = '<tenantId>' AND remarks LIKE '%email-ingestion: <messageId>%';
  ```

- The charge description follows `Email documents: <subject> (from: <sender>, <date>)`.
- OCR failure is **non-fatal**: the document is still inserted with `documentType = UNPROCESSED`
  rather than failing the ingest. A document that landed but has no parsed amount/date likely hit an
  OCR error — not an ingestion failure.
- A metadata-only payload (no inline `content`) or one where **every** document already exists by
  hash inserts no new rows; the ingest still returns `INSERTED` with a synthetic `ingestId`.

---

## 3. Triaging the quarantine table

Quarantined emails are recorded in `accounter_schema.email_ingestion_quarantine`:

```sql
SELECT id, reason_code, tenant_candidate, message_id, raw_message_hash,
       correlation_id, status, retry_count, created_at
FROM accounter_schema.email_ingestion_quarantine
ORDER BY created_at DESC
LIMIT 50;
```

- `reason_code` tells you why (almost always `NO_DOCUMENTS` from the ingest backstop).
- `tenant_candidate` may be `NULL` for orphaned rows; those are **invisible to tenant sessions** by
  RLS and only visible to ops tooling using the RLS-bypassing pool.
- Join back to the gateway logs via `correlation_id` to find the upstream cause (e.g. the real
  `PARSE_ERROR`/`OVERSIZE_MESSAGE` behind a `NO_DOCUMENTS`).
- `status` / `retry_count` support reprocessing workflows.

---

## 4. Quick reference: gateway log events

Grep gateway logs by these `message` values (all structured JSON, all carry `correlationId`):

| Event                                      | Meaning                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `incoming request`                         | Request hit the router.                                        |
| `webhook authenticity check failed`        | Stage B rejection (`reason`).                                  |
| `webhook: MIME extraction failed`          | Stage C parse/size failure (`reason`).                         |
| `webhook accepted`                         | Passed auth + parse; `attachmentCount` logged.                 |
| `orchestrate:control:start/granted/denied` | Control call + tenant resolution.                              |
| `orchestrate:treatment:complete`           | `documentCount` after treatment (0 ⇒ upcoming `NO_DOCUMENTS`). |
| `treatment: body→PDF render failed`        | Chromium / render problem; body document dropped.              |
| `treatment: internal-link fetch failed`    | Link fetch error (or SSRF guard returned empty).               |
| `orchestrate:ingest:failed`                | Ingest call failed (`reason`).                                 |
| `orchestrate:ingest:complete`              | Final `outcome`, `ingestId`, `reasonCode`, `durationMs`.       |
| `shadow:orchestration:*`                   | Shadow-mode async run results.                                 |

---

## 5. Shadow mode caveat

When `EMAIL_INGESTION_SHADOW_MODE=1`, `/webhook` responds `202` **immediately** and runs
orchestration asynchronously (`webhook.ts`). The HTTP response will **not** contain the real outcome
— look for `shadow:orchestration:complete` / `:failed` / `:error` log lines (by `correlationId`) to
see what actually happened. The legacy listener remains the authoritative handler in this mode.
