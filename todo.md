# Multi-tenant Gmail Listener v2 - Implementation Checklist

Use this checklist as the execution tracker for the v2 plan.

Primary references:

- docs/multi-tenant-gmail-listener/architecture-plan.md
- docs/multi-tenant-gmail-listener/data-flow.md
- docs/multi-tenant-gmail-listener/prompt-plan.md

## How To Use This Checklist

- [ ] Work in order from top to bottom unless a blocker requires reordering.
- [ ] Keep each completed step in a small PR-sized change.
- [ ] Write failing tests first for each step, then implementation, then make tests green.
- [ ] Do not disable or break the current listener path during implementation.
- [ ] Keep `MULTI_TENANT_INGEST_V2_ENABLED` disabled by default until sign-off.

## Global Rules (Always True)

- [ ] Use `yarn` only.
- [ ] Use ESM imports with `.js` suffixes in TS source.
- [ ] Run `yarn generate` after GraphQL schema changes.
- [ ] If resolver dependencies change, update injector mocks in resolver tests.
- [ ] No direct DB writes from gateway.
- [ ] Server remains authoritative for tenant resolution and document insertions.
- [ ] No orphaned code: every new module is wired, tested, and reachable.

## Phase 0 - Pre-flight and Baseline

- [ ] Confirm current listener health endpoint is working.
- [ ] Confirm current Gmail polling/subscription path still processes existing flow.
- [ ] Confirm architecture and prompt plan are up to date.
- [ ] Confirm local environment can run unit and integration tests.
- [ ] Confirm local migrations run cleanly with current baseline.
- [ ] Record baseline metrics for current listener success/error rates.

## Phase 1 - Foundation (S01-S02)

### S01: Feature flags and env defaults

- [ ] Add v2/shadow flags to gateway environment validation.
- [ ] Add corresponding server-side feature flags.
- [ ] Add environment parsing tests for defaults and explicit values.
- [ ] Verify default behavior remains legacy-only when flags are not set.
- [ ] Document flag defaults and behavior in docs.

### S02: Shared contracts and canonical reason codes

- [ ] Add canonical ingest outcomes: inserted, duplicate, quarantined, rejected.
- [ ] Add canonical reason codes:
- [ ] UNKNOWN_ALIAS
- [ ] INVALID_AUTH
- [ ] REPLAY_DETECTED
- [ ] GRANT_INVALID
- [ ] TENANT_MISMATCH
- [ ] NO_DOCUMENTS
- [ ] PARSE_ERROR
- [ ] OVERSIZE_MESSAGE
- [ ] TIMEOUT
- [ ] TRANSIENT_UPSTREAM
- [ ] Add tests that guard enum/code completeness.
- [ ] Replace any new magic strings with shared constants.

### Phase 1 verification

- [ ] Run targeted tests for env/contracts.
- [ ] Run `yarn test`.
- [ ] Run `yarn lint`.

## Phase 2 - Persistence Foundation (S03-S05)

### S03: Alias routing table migration

- [ ] Create migration for alias routing table.
- [ ] Include active flag and normalized alias field.
- [ ] Add uniqueness/indexes for fast lookup and conflict prevention.
- [ ] Register migration in `packages/migrations/src/run-pg-migrations.ts`.
- [ ] Add migration verification test/check for schema assumptions.

### S04: Ingest grants migration

- [ ] Create migration for grants table with `jti` uniqueness.
- [ ] Include tenant binding and message binding fields.
- [ ] Include `expires_at` and `consumed_at` fields.
- [ ] Add indexes for grant lookup and expiry operations.
- [ ] Register migration in runner.

### S05: Replay nonce and quarantine migrations

- [ ] Create replay nonce persistence with uniqueness guarantees.
- [ ] Create quarantine table with required fields:
- [ ] reason_code
- [ ] tenant_candidate
- [ ] message identifiers
- [ ] raw_message_hash
- [ ] correlation_id
- [ ] status
- [ ] retry_count
- [ ] created_at and updated_at
- [ ] Add triage indexes (reason_code/status/date).
- [ ] Register migration(s) in runner.

### Phase 2 verification

- [ ] Run `yarn local:setup`.
- [ ] Run migration/integration tests touching these tables.
- [ ] Validate unique constraints and basic lookup queries.

## Phase 3 - Server Control Plane (S06-S07)

### S06: Alias resolution and grant issuance provider

- [ ] Add provider under `packages/server/src/modules/gmail-listener/providers/`.
- [ ] Implement alias resolution logic (normalized + active only).
- [ ] Implement grant issuance payload shape with metadata.
- [ ] Add tests for:
- [ ] known alias
- [ ] unknown alias
- [ ] inactive alias
- [ ] grant payload validity
- [ ] Confirm injector mock coverage for new dependencies.

### S07: GraphQL control operation wiring

- [ ] Extend typeDefs with control input/output.
- [ ] Add resolver wiring via `context.injector.get(...)`.
- [ ] Enforce control-plane auth/role.
- [ ] Add resolver tests for success and auth failure.
- [ ] Run GraphQL codegen and fix generated type references.

### Phase 3 verification

- [ ] Run targeted provider/resolver tests.
- [ ] Run `yarn generate`.
- [ ] Run `yarn test`.
- [ ] Run `yarn lint`.

## Phase 4 - Server Ingest Plane (S08-S10)

### S08: Grant validation and single-use consume

- [ ] Implement grant validation checks:
- [ ] tenant binding
- [ ] message binding
- [ ] expiry
- [ ] unconsumed state
- [ ] Implement atomic consume behavior (`consumed_at` set once).
- [ ] Add tests for valid/expired/reused/mismatch scenarios.

### S09: Idempotency and dedup

- [ ] Implement idempotency key handling.
- [ ] Return stable prior result for repeated key.
- [ ] Implement tenant-scoped dedup fingerprinting.
- [ ] Persist dedup decisions with auditable metadata.
- [ ] Add tests for duplicate handling and cross-tenant isolation.

### S10: GraphQL ingest operation wiring

- [ ] Extend GraphQL typeDefs for ingest operation.
- [ ] Wire resolver to grant/idempotency/dedup flow.
- [ ] Map all non-success outcomes to canonical reason codes.
- [ ] Add resolver tests for inserted/duplicate/quarantined/rejected outcomes.
- [ ] Ensure correlation/audit metadata propagation.
- [ ] Run GraphQL codegen.

### Phase 4 verification

- [ ] Run targeted server tests.
- [ ] Run `yarn generate`.
- [ ] Run `yarn test`.
- [ ] Run `yarn test:integration`.

## Phase 5 - Gateway Auth and Ingress (S11-S12)

### S11: Cloudflare authenticity verifier

- [ ] Add verifier module for signature/timestamp/nonce validation.
- [ ] Add env config for verifier key/secret and time window.
- [ ] Add replay nonce check integration interface.
- [ ] Add unit tests for:
- [ ] valid signature
- [ ] invalid signature
- [ ] stale timestamp
- [ ] replayed nonce

### S12: Cloudflare webhook route

- [ ] Add dedicated webhook endpoint in gateway.
- [ ] Apply route-specific verifier authentication.
- [ ] Keep existing API key auth for operational routes.
- [ ] Gate webhook behind feature flag.
- [ ] Add endpoint tests for enabled/disabled and malformed input cases.

### Phase 5 verification

- [ ] Run targeted gateway tests.
- [ ] Run `yarn test`.
- [ ] Confirm legacy routes still behave exactly as before.

## Phase 6 - Gateway Extraction and Orchestration (S13-S15)

### S13: MIME parsing and extraction with limits

- [ ] Build extraction pipeline for sender evidence + documents.
- [ ] Enforce limits:
- [ ] raw MIME <= 25 MB
- [ ] attachment count <= 10
- [ ] extracted documents total <= 20 MB
- [ ] Map parse/limit failures to canonical reason codes.
- [ ] Add unit tests for boundary conditions.

### S14: Gateway server client (control + ingest)

- [ ] Add typed GraphQL operation documents for control and ingest.
- [ ] Include correlation_id and idempotency_key in request payloads.
- [ ] Implement retry policy:
- [ ] control: 3s timeout, up to 2 retries with backoff
- [ ] ingest: 10s timeout, 1 retry for network/5xx only
- [ ] Add client tests for retry and timeout mapping.
- [ ] Run codegen if GraphQL operations changed.

### S15: End-to-end gateway orchestration

- [ ] Wire flow: verify -> control -> extract -> ingest.
- [ ] Implement shadow-mode behavior when enabled.
- [ ] Keep existing Gmail listener path unchanged.
- [ ] Add orchestration tests for happy path and fallback behavior.

### Phase 6 verification

- [ ] Run targeted gateway tests.
- [ ] Run `yarn generate` if needed.
- [ ] Run `yarn test`.

## Phase 7 - Observability and Hardening (S16-S17)

### S16: Correlation and observability

- [ ] Generate and propagate a single correlation_id end-to-end.
- [ ] Add structured logs with:
- [ ] correlation_id
- [ ] decision_id
- [ ] audit_id
- [ ] reason_code
- [ ] outcome
- [ ] tenant_id (when known)
- [ ] Add metrics counters/timers for:
- [ ] success
- [ ] quarantine by reason_code
- [ ] replay rejects
- [ ] dedup hits
- [ ] latency (control and ingest)
- [ ] Add tests for correlation and metric emission hooks.

### S17: Integration and adversarial suites

- [ ] Add server integration tests for control and ingest paths.
- [ ] Add gateway integration tests for Cloudflare ingress flow.
- [ ] Add adversarial tests:
- [ ] cross-tenant insertion attempt
- [ ] grant replay/reuse
- [ ] invalid signature bypass attempt
- [ ] Ensure deterministic fixtures and no flaky timing dependencies.

### Phase 7 verification

- [ ] Run `yarn test`.
- [ ] Run `yarn test:integration`.
- [ ] Validate no cross-tenant writes in test results.

## Phase 8 - Cloudflare Setup, Deployment, and Rollout (S18-S20)

### S18: Cloudflare designated setup/integration instructions

- [ ] Create deployment runbook under `docs/multi-tenant-gmail-listener/`.
- [ ] Include:
- [ ] Cloudflare Email Routing setup for tenant aliases
- [ ] destination gateway endpoint setup
- [ ] signature config and secret rotation process
- [ ] optional mTLS path
- [ ] IP allowlist update flow
- [ ] Add env var mapping table for gateway and server.
- [ ] Add staging smoke tests for valid/invalid/replay cases.
- [ ] Add rollback-to-legacy route procedure.
- [ ] Add on-call troubleshooting by reason_code.

### S19: Final wiring and orphan code cleanup

- [ ] Confirm every new module is wired to runtime or intentionally flag-gated.
- [ ] Remove incomplete scaffolding/TODOs from implementation steps.
- [ ] Confirm health endpoints and legacy startup still function.
- [ ] Confirm docs are aligned with final code paths.

### S20: Final verification and release readiness

- [ ] Run full validation sequence:
- [ ] `yarn generate`
- [ ] `yarn lint`
- [ ] `yarn test`
- [ ] `yarn test:integration`
- [ ] Fix all failures and rerun until green.
- [ ] Produce release checklist with:
- [ ] flags and defaults
- [ ] migration order
- [ ] staging sign-off
- [ ] production cutover steps
- [ ] rollback procedure

## Shadow Mode and Cutover Checklist

- [ ] Shadow mode enabled in staging.
- [ ] Dual-run parity logs collected for selected tenants.
- [ ] Mismatch rate reviewed and accepted.
- [ ] Security tests reviewed (auth/replay/cross-tenant).
- [ ] Tenant onboarding runbook tested by ops.
- [ ] Tenant-by-tenant cutover plan approved.
- [ ] Rollback trigger criteria documented and on-call aware.

## Rollback Checklist

- [ ] Switch routing to legacy-only mode.
- [ ] Disable v2 feature flags.
- [ ] Confirm legacy listener processed new traffic.
- [ ] Confirm no data loss window.
- [ ] Capture incident summary with correlation IDs and reason codes.

## Done Definition

- [ ] All planned steps (S01-S20) completed.
- [ ] Unit + integration suites are green.
- [ ] No unresolved high-severity security gaps.
- [ ] No orphaned code paths.
- [ ] Cloudflare setup and rollback docs are complete.
- [ ] Team sign-off recorded (engineering + ops).

## Notes

- [ ] Add owner and target date per section.
- [ ] Add PR links per completed step.
- [ ] Track blockers and mitigation decisions here.
