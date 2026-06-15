# Multi-tenant Email Ingestion v2 - Implementation Checklist

Use this checklist as the execution tracker for the updated strategy.

Primary references:

- docs/multi-tenant-gmail-listener/architecture-plan.md
- docs/multi-tenant-gmail-listener/data-flow.md
- docs/multi-tenant-gmail-listener/prompt-plan.md

## Locked Strategy

- [ ] New gateway service is greenfield: `packages/email-ingestion-gateway`.
- [ ] Legacy `packages/gmail-listener` remains active during rollout.
- [ ] No runtime code sharing from legacy listener into new gateway package.
- [ ] If similar logic is needed, duplicate and adapt in new gateway package.
- [ ] Server shared ingestion logic is renamed early to `email-ingestion` naming.

## Always-on Rules

- [ ] Use `yarn` only.
- [ ] Use ESM imports with `.js` suffixes in TS source.
- [ ] Run `yarn generate` after GraphQL schema changes.
- [ ] If resolver dependencies change, update injector mocks in tests.
- [ ] No direct DB writes from gateway.
- [ ] Server remains authoritative for tenant resolution and inserts.
- [ ] Keep each step PR-sized with tests and clear verification.

## Phase 0 - Baseline and Guardrails

- [ ] Confirm current legacy listener health endpoint is working.
- [ ] Confirm current Gmail polling/subscription path still processes existing traffic.
- [ ] Confirm architecture, data flow, and prompt plan docs are aligned.
- [ ] Confirm local unit and integration suites run successfully.
- [ ] Record baseline metrics for legacy path success/error/retry behavior.
- [ ] Add a temporary import-guard check script for new gateway package:
- [ ] Fail CI if any import path from `packages/email-ingestion-gateway` references
      `packages/gmail-listener`.

## Phase 1 - Early Server Renaming (S01-S02)

### S01: Introduce new server module namespace ✅ PR #3658

- [x] Create `packages/server/src/modules/email-ingestion/`.
- [x] Move or duplicate server logic from gmail-listener naming into new module naming.
- [x] Keep compatibility behavior so existing callers are not broken.
- [x] Add tests proving both compatibility and new module wiring.

### S02: Internal naming migration bridge ✅ (this PR)

- [x] Rename server provider/resolver/service identifiers to email-ingestion terminology.
- [x] Keep compatibility adapters where old names are still needed temporarily.
- [x] Update tests and docs to use new naming first.
- [x] Verify new work does not depend on deprecated names.

### Phase 1 verification

- [x] Run targeted server module tests. (S01: 8/8 pass, S02: 12/12 pass)
- [x] Run `yarn test`.
- [x] Run `yarn lint`.
- [ ] Deploy early server rename changes before gateway integration milestones.

## Phase 2 - New Gateway Package Foundation (S03-S05)

### S03: Feature flags and env defaults ✅ (this PR)

- [x] Add v2 and shadow flags to server env validation.
- [x] Add matching flags to new gateway env validation.
- [x] Add env parsing tests for defaults and explicit values.
- [x] Verify default behavior stays legacy-safe when flags are off.

### S04: Scaffold greenfield gateway package ✅ (this PR)

- [x] Create `packages/email-ingestion-gateway` package scaffold.
- [x] Add package scripts, tsconfig, entrypoint, and baseline types.
- [x] Add independent env module and health endpoint.
- [x] Ensure workspace build/test scripts include new package.

### S05: Gateway runtime baseline ✅ (this PR)

- [x] Add structured logging and correlation scaffolding.
- [x] Add readiness endpoint and runtime error boundaries.
- [x] Add smoke/unit tests for bootstrap, env parsing, and health endpoints.

### Phase 2 verification

- [ ] Run package-level tests for new gateway. (S03: 12/12 pass)
- [ ] Run `yarn test`.
- [ ] Confirm import-guard check catches legacy imports.

## Phase 3 - Contracts and Persistence (S06-S09)

### S06: Canonical contracts and reason codes ✅ (this PR)

- [x] Add canonical outcomes and reason codes in server.
- [x] Add equivalent constants in new gateway package.
- [x] Ensure no runtime import from legacy package for shared constants.
- [x] Add tests guarding completeness and naming stability.

### S07: Alias routing migration ✅ (this PR)

- [x] Create migration for recipient alias routing table.
- [x] Add normalization strategy and active flag.
- [x] Add uniqueness/indexes for efficient lookups.
- [x] Register migration in `packages/migrations/src/run-pg-migrations.ts`.

### S08: Grants migration ✅ (this PR)

- [x] Create migration for ingest grants table with `jti` uniqueness.
- [x] Include tenant binding, message binding, `expires_at`, `consumed_at`.
- [x] Add lookup and expiry indexes.
- [x] Register migration in migration runner.

### S09: Replay nonce and quarantine migrations ✅ (this PR)

- [x] Create replay nonce persistence with uniqueness guarantees.
- [x] Create quarantine table with required fields:
- [x] reason_code
- [x] tenant_candidate
- [x] message identifiers
- [x] raw_message_hash
- [x] correlation_id
- [x] status
- [x] retry_count
- [x] created_at and updated_at
- [x] Add triage indexes by reason_code, status, and date.
- [x] Register migration(s) in runner.

### Phase 3 verification

- [x] Run `yarn local:setup`.
- [x] Run migration/integration tests for new tables. (S09: 26/26 pass)
- [ ] Validate uniqueness constraints and consume-once assumptions.

## Phase 4 - Server Control and Ingest Core (S10-S14)

### S10: Control provider ✅ (this PR)

- [x] Implement alias resolution and grant issuance in email-ingestion module.
- [x] Include decision and audit metadata.
- [x] Add tests for known/unknown/inactive alias flows.

### S11: Control GraphQL operation ✅ (this PR)

- [x] Add control operation typeDefs under email-ingestion naming.
- [x] Add resolver wiring via injector.
- [x] Enforce control-plane auth and role constraints.
- [x] Add resolver success/auth-failure tests.
- [x] Run GraphQL codegen.

### S12: Grant validation and single-use consume ✅ (this PR)

- [x] Implement strict validation: scope, tenant, message binding, expiry, unconsumed.
- [x] Implement atomic consume-once behavior.
- [x] Add negative tests for reused/expired/mismatched grant behavior.

### S13: Idempotency and dedup ✅ (this PR)

- [x] Implement idempotency key persistence and stable duplicate result behavior.
- [x] Implement tenant-scoped dedup fingerprints.
- [x] Persist dedup decisions for auditability.
- [x] Add tests for duplicate handling and cross-tenant isolation.

### S13.5: Gateway control-plane service credential ✅ (this PR)

- [x] Add `'gatewayControlPlane'` to `AuthType` and `RawAuth.authType`.
- [x] Extend auth plugin to extract `X-Gateway-CP-Token` header.
- [x] Add `GATEWAY_CP_TOKEN` optional env var with timing-safe validation.
- [x] Implement `handleGatewayControlPlaneAuth()` in `AuthContextProvider`: no DB, no tenant,
      `roleId: 'gateway_control_plane'`.
- [x] Update `requestIngestControl` to require `@requiresRole(role: "gateway_control_plane")`.
- [x] Add TDD tests: valid/invalid token, missing env, no DB calls.
- [x] Add role isolation tests: gateway_control_plane can call control op, gmail_listener cannot,
      gateway_control_plane cannot call ingest op.

### S13.6: Server data-plane DB boundary hardening ✅ (this PR)

- [x] Refactor `EmailIngestionIdempotencyProvider` to `Scope.Operation`.
- [x] Inject `TenantAwareDBClient` (RLS-enforced) for idempotency + dedup reads/writes instead of
      the raw `DBProvider` pool.
- [x] Keep `DBProvider`/raw-pool access only in `EmailIngestionControlProvider` for pre-tenant
      control-plane ops (alias resolution, grant issuance/validation) where no tenant session exists
      yet.
- [x] Confirm control-plane and data-plane responsibilities live in separate providers (no hybrid).
- [x] Remove the `no-restricted-imports` ESLint exemption for the idempotency provider (no longer
      touches `DBProvider`).
- [x] Update provider tests/mocks to the new `TenantAwareDBClient` boundary.
- [x] Add tenant-guardrail tests: reads route through the tenant-aware client; cross-tenant writes
      propagate the RLS WITH CHECK violation.
- [ ] Live-DB integration test for RLS row-filtering (deferred: superuser test connection bypasses
      RLS row-filtering; cross-tenant isolation is asserted via owner_id scoping + WITH CHECK
      propagation at the provider boundary). Quarantine provider is tenant-bound and will follow the
      same boundary when introduced (S14).

### S14: Ingest GraphQL operation ✅ (this PR)

- [x] Add `ingestEmail` mutation + `IngestEmailInput`, `ExtractedDocumentInput`,
      `IngestEmailSuccess`, `IngestOutcome` enum, `IngestEmailResult` union to typeDefs.
- [x] Create `EmailIngestionIngestProvider` (Scope.Singleton, raw pool) — orchestrates grant
      validation → idempotency check → dedup check → quarantine → insert flow.
- [x] Create `email-ingestion-ingest.resolver.ts` — maps `IngestResult` outcomes to GraphQL enum
      (INSERTED/DUPLICATE/QUARANTINED/REJECTED) and CommonError on unexpected failure.
- [x] Register new provider and resolver in `index.ts`.
- [x] Add `IngestEmailSuccess` to ESLint `strict-id-in-types` exceptions.
- [x] Add `email-ingestion-ingest.provider.ts` to `no-restricted-imports` exemption (uses raw pool
      intentionally; TenantAwareDBClient throws UNAUTHENTICATED for gateway_control_plane auth).
- [x] TDD: resolver tests for all 4 outcomes + unexpected error + field pass-through.
- [x] TDD: provider tests for grant validation, idempotency hit, dedup hit, quarantine (no docs),
      happy path (inserted) + DB call count.
- [x] Add `ingestEmail` role isolation tests (gateway_control_plane can call; gmail_listener
      cannot).
- [x] Run GraphQL codegen (`node_modules/.bin/graphql-codegen`) — types generated successfully.
- [x] `insertEmailDocuments` kept as-is (legacy gmail-listener compat) — delegation deferred because
      input shapes are incompatible (raw file blobs vs. pre-extracted metadata).

### Phase 4 verification

- [ ] Run targeted server tests.
- [ ] Run `yarn generate`.
- [ ] Run `yarn test`.
- [ ] Run `yarn test:integration`.

## Phase 5 - New Gateway Implementation (S15-S18)

### S15: Cloudflare authenticity verifier

- [ ] Add signature/mTLS authenticity checks in new gateway package.
- [ ] Add IP allowlist check as defense-in-depth.
- [ ] Add timestamp window and nonce replay checks.
- [ ] Add tests for valid/invalid/stale/replayed requests.

### S16: Webhook endpoint

- [ ] Add Cloudflare ingress endpoint in new gateway service.
- [ ] Apply route-specific authenticity and replay checks.
- [ ] Enforce feature-flag gating.
- [ ] Add endpoint tests for malformed/auth-failure/disabled cases.

### S17: Extraction pipeline (duplicate/adapt, no sharing)

- [ ] Implement MIME parsing and extraction in new gateway package.
- [ ] Enforce limits:
- [ ] raw MIME <= 25 MB
- [ ] attachment count <= 10
- [ ] extracted documents total <= 20 MB
- [ ] Map failures to canonical reason codes.
- [ ] Add boundary and failure tests.
- [ ] Confirm no extraction-helper imports from legacy listener package.

### S18: Control -> ingest orchestration

- [ ] Add server client operations for control and ingest.
- [ ] Include `correlation_id` and `idempotency_key` in payloads.
- [ ] Implement retries/timeouts:
- [ ] control: 3s timeout, up to 2 retries with backoff
- [ ] ingest: 10s timeout, 1 retry for network or 5xx only
- [ ] Add retry matrix and outcome mapping tests.

### Phase 5 verification

- [ ] Run targeted gateway tests.
- [ ] Run `yarn generate` if operation typings changed.
- [ ] Run `yarn test`.

## Phase 6 - Observability, Security, and Rollout Readiness (S19-S20)

### S19: Observability and adversarial suites

- [ ] Propagate a single correlation_id end-to-end.
- [ ] Add structured logs: correlation_id, decision_id, audit_id, reason_code, outcome, tenant_id.
- [ ] Add metrics: success, quarantine by reason, replay rejects, dedup hits, latency.
- [ ] Add integration and adversarial tests:
- [ ] invalid auth
- [ ] replay attempt
- [ ] grant reuse
- [ ] tenant mismatch
- [ ] cross-tenant insertion prevention
- [ ] Add shadow-mode parity tests while legacy path remains active.

### S20: Cloudflare setup, final wiring, release checklist

- [ ] Add/update Cloudflare setup runbook under docs/multi-tenant-gmail-listener.
- [ ] Include routing, secrets, rotation, optional mTLS, allowlist updates.
- [ ] Add staging smoke checklist:
- [ ] valid message
- [ ] unknown alias
- [ ] invalid signature
- [ ] replay attempt
- [ ] Add rollback procedure to legacy listener path.
- [ ] Verify no orphaned code in new server module and new gateway package.
- [ ] Run final validation sequence:
- [ ] `yarn generate`
- [ ] `yarn lint`
- [ ] `yarn test`
- [ ] `yarn test:integration`

## Anti-coupling Gate (Mandatory Before Merge)

- [ ] Confirm no runtime import from `packages/email-ingestion-gateway` into
      `packages/gmail-listener`.
- [ ] Confirm no runtime import from `packages/email-ingestion-gateway` to any legacy listener
      source.
- [ ] If similar behavior exists in legacy code, confirm duplicate/adapt approach was used.
- [ ] Keep behavior alignment through tests and contracts, not shared runtime modules.

## Cutover Checklist

- [ ] Server rename changes are deployed and stable.
- [ ] New gateway service deployed in staging.
- [ ] Shadow mode enabled and parity reviewed.
- [ ] Security tests reviewed and accepted.
- [ ] Tenant-by-tenant cutover plan approved.
- [ ] Rollback trigger criteria documented and on-call aware.

## Rollback Checklist

- [ ] Switch routing to legacy-only mode.
- [ ] Disable v2 feature flags.
- [ ] Confirm legacy listener resumes/continues processing safely.
- [ ] Confirm no data loss window.
- [ ] Capture incident summary with correlation_id and reason_code references.

## Done Definition

- [ ] Steps S01-S20 completed.
- [ ] Unit and integration suites are green.
- [ ] No unresolved high-severity security gaps.
- [ ] No orphaned code paths.
- [ ] No runtime code sharing between legacy and new gateway packages.
- [ ] Cloudflare setup and rollback docs are complete.
- [ ] Engineering and ops sign-off recorded.

## Notes

- [ ] Add owner and target date per phase.
- [ ] Add PR links per completed step.
- [ ] Track blockers and mitigation decisions.
