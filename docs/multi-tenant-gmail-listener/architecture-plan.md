# Multi-tenant Email Ingestion Plan (Cloudflare + Gateway + Server)

## Goal

Support many tenants with minimal operational risk by routing inbound email through Cloudflare Email
to a private Gateway, while keeping tenant resolution and data persistence authoritative in Server.

## Locked Decisions

1. Cloudflare authenticity uses cryptographic verification as primary control.
2. IP allowlist is enabled as defense-in-depth only (never as sole trust signal).
3. Ingest grants are single-use and message-bound (exactly-once at grant layer).
4. API retries are idempotent and return prior result for duplicates.
5. Quarantine is persisted server-side for 30 days.
6. Reprocess permission is ops-only.
7. Retry model is manual plus scheduled auto-retry for transient failures.
8. Limits and timeout budgets are enforced in Gateway and Server (defined below).
9. Existing listener remains active until the new service is implemented, deployed, and tested.
10. Readiness is driven by strong unit and integration suites, plus shadow validation.
11. New gateway implementation is greenfield under `packages/email-ingestion-gateway`.
12. No runtime code is shared from `packages/gmail-listener` into the new gateway package.
13. If similar behavior is needed, duplicate and adapt logic in the new gateway package.
14. Server shared ingestion logic is renamed early to `email-ingestion` naming before gateway
    integration.

## Implementation Boundaries

1. Legacy listener code is reference-only for behavior parity during rollout.
2. New v2 gateway runtime modules live only under `packages/email-ingestion-gateway`.
3. Contract and behavior parity is enforced by tests, not by shared runtime modules.
4. Temporary server compatibility bridges are allowed during migration and removed after cutover.

## Final Architecture

1. Cloudflare Email receives inbound mail for tenant aliases (recommended: non-guessable aliases).
2. Cloudflare forwards each event to a private Gateway endpoint.
3. Gateway validates authenticity and replay constraints before parsing MIME.
4. Gateway calls Server control endpoint to resolve tenant and request ingest grant.
5. Server issues short-lived, message-bound, single-use ingest grant.
6. Gateway extracts documents and sender evidence, then calls Server ingest endpoint.
7. Server validates grant, idempotency, tenant scope, and dedup constraints.
8. Server writes via existing tenant guardrails and returns auditable outcome.

## Trust and Privilege Model

1. Cloudflare -> Gateway trust
   1. Primary: cryptographic authenticity validation (signed request or mTLS).
   2. Secondary: source IP allowlist.
   3. IP match cannot override failed cryptographic validation.
   4. Enforce replay checks: timestamp window and nonce uniqueness.
2. Gateway -> Server control-plane identity
   1. Can resolve alias and request grant.
   2. Cannot insert documents directly.
3. Gateway -> Server data-plane grant
   1. Short-lived (recommended TTL: <= 5 minutes).
   2. Scoped to one tenant and one ingestion action.
   3. Single-use with jti and consumed_at semantics.
4. Prohibited patterns
   1. No super-user ingestion token.
   2. No direct DB access from Gateway.
   3. No unauthenticated routing snapshot endpoint.

## End-to-End Flow

1. Inbound email arrives at tenant alias.
2. Cloudflare forwards recipient alias, headers, and raw payload to Gateway.
3. Gateway validates authenticity, request age, and nonce replay.
4. Gateway computes raw_message_hash and creates correlation_id.
5. Gateway calls Server control endpoint with alias plus message metadata.
6. Server resolves tenant and policy, emits decision_id, and returns ingest grant.
7. Gateway parses MIME and extracts candidate documents plus sender evidence.
8. Gateway calls ingest endpoint with grant, idempotency_key, and extraction payload.
9. Server validates grant signature, expiry, scope, and single-use jti.
10. Server enforces idempotency and dedup; inserts or returns duplicate outcome.
11. Server writes audit trail with correlation_id and decision_id.
12. Gateway applies outcome handling: processed, quarantined, retry, or alert.

## Data Contracts (Minimum v2)

1. Control endpoint request
   1. recipient_alias
   2. provider_event_id, message_id, thread_id
   3. envelope/from/to metadata
   4. raw_message_hash
   5. received_at
   6. correlation_id
2. Control endpoint response
   1. tenant_id
   2. decision_id and audit_id
   3. ingest_grant (includes jti, tenant_id, message binding, action scope, expires_at)
   4. optional policy/profile id
3. Ingest endpoint request
   1. ingest_grant
   2. idempotency_key
   3. extracted_documents (hash, size, mime_type, filename, parse result)
   4. sender_evidence (alias, from, reply_to, forwarding headers, issuer candidate)
   5. message_metadata
   6. correlation_id
4. Ingest endpoint response
   1. outcome (inserted, duplicate, quarantined, rejected)
   2. ingest_id or existing_ingest_id
   3. audit_id and reason_code (if not inserted)

## Idempotency, Dedup, and Replay

1. Replay protection
   1. Cloudflare request nonce must be unique in replay cache within configured window.
   2. Ingest grant jti must be consumed at most once.
2. Idempotency
   1. Ingest endpoint requires idempotency_key.
   2. Repeat request with same key returns previous result, not a new insert.
3. Dedup
   1. Server dedup key includes tenant_id and message/document fingerprints.
   2. Dedup decisions are persisted and auditable.

## Failure and Quarantine Model

1. Quarantine storage
   1. Persist in Server DB (authoritative).
   2. Retention: 30 days.
2. Quarantine record fields
   1. reason_code
   2. tenant_candidate
   3. message identifiers and raw_message_hash
   4. correlation_id
   5. received_at, status, retry_count
3. Reprocess policy
   1. Ops-only permission.
   2. Manual reprocess for non-transient failures.
   3. Scheduled auto-retry only for transient reason codes.
4. Required reason codes
   1. UNKNOWN_ALIAS
   2. INVALID_AUTH
   3. REPLAY_DETECTED
   4. GRANT_INVALID
   5. TENANT_MISMATCH
   6. NO_DOCUMENTS
   7. PARSE_ERROR
   8. OVERSIZE_MESSAGE
   9. TIMEOUT
   10. TRANSIENT_UPSTREAM

## Limits and Timeout Budgets (MVP)

1. Raw MIME max size: 25 MB.
2. Attachment count max: 10.
3. Total extracted document bytes max: 20 MB.
4. Control endpoint timeout: 3 seconds, up to 2 retries with backoff.
5. Ingest endpoint timeout: 10 seconds, 1 retry for network or 5xx only.
6. Oversize or timeout outcomes are quarantined with explicit reason_code.

## Rollout and Development Process

1. Keep current listener active in production during buildout.
2. Deploy server naming migration to `email-ingestion` early, before gateway integration milestones.
3. Deliver new greenfield gateway service in parallel path, then validate in shadow mode.
4. Enforce anti-coupling guard: no runtime imports from `packages/gmail-listener` into
   `packages/email-ingestion-gateway`.
5. Use test confidence, not strict cutover gates, as the primary readiness signal.
6. Cut over tenant-by-tenant only after passing test suite and shadow checks.
7. Preserve fast rollback by keeping old listener operational until full confidence.

## Test Strategy (Required)

1. Unit tests
   1. Gateway authenticity validation, nonce replay checks, MIME parsing, timeout handling.
   2. Server control resolution, grant issuance, grant validation, idempotency, dedup.
2. Integration tests
   1. Cloudflare-like event -> Gateway -> Server happy path.
   2. Unknown alias, invalid auth, replay attempt, grant reuse, tenant mismatch.
   3. Duplicate delivery and retry behavior.
   4. Quarantine creation and ops reprocess flows.
3. Security tests
   1. Cross-tenant insertion adversarial tests.
   2. Signature bypass and replay attack simulations.
4. Regression tests
   1. Existing listener remains stable while new path is introduced.
   2. Dual-run comparisons for selected tenants in shadow mode.

## Observability and Audit

1. Propagate correlation_id across Cloudflare, Gateway, Server, and DB audit records.
2. Emit structured logs with decision_id, audit_id, tenant_id, reason_code, and outcome.
3. Track metrics: success rate, quarantine rate by reason_code, replay rejects, dedup hits, p95/p99
   latency, retry counts.
4. Alert on spikes in INVALID_AUTH, REPLAY_DETECTED, and UNKNOWN_ALIAS.

## Scope

1. In scope
   1. Cloudflare inbound routing, Gateway orchestration, Server validation and insertion.
   2. Quarantine, retry, alerting, and auditability.
   3. Unit and integration test suites for safe rollout.
2. Out of scope
   1. Direct DB writes from Gateway.
   2. Global plaintext routing snapshots.
   3. Super-user insertion credentials.
   4. Runtime code sharing between legacy listener and new gateway package.

## Relevant Code Touchpoints

1. New gateway package (greenfield)
   1. packages/email-ingestion-gateway/src/
2. Legacy listener (rollout stability and behavioral reference only)
   1. packages/gmail-listener/src/gmail-service.ts
   2. packages/gmail-listener/src/server-requests.ts
   3. packages/gmail-listener/src/environment.ts
3. Server authoritative path (email-ingestion naming)
   1. packages/server/src/modules/email-ingestion/
   2. packages/server/src/modules/auth/providers/auth-context.provider.ts
   3. packages/server/src/modules/app-providers/tenant-db-client.ts
4. Temporary server compatibility bridge (during migration)
   1. packages/server/src/modules/gmail-listener/

## Success Criteria

1. No cross-tenant insertions in security tests.
2. All ingest writes remain server-mediated and auditable.
3. Unknown or ambiguous routes are quarantined, not auto-inserted.
4. Grant replay and reuse attempts are rejected and auditable.
5. Unit and integration suites cover critical happy/failure/security paths.
6. Shadow mode demonstrates parity before tenant cutover.
