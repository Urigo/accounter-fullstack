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

### S02: Internal naming migration bridge

- [ ] Rename server provider/resolver/service identifiers to email-ingestion terminology.
- [ ] Keep compatibility adapters where old names are still needed temporarily.
- [ ] Update tests and docs to use new naming first.
- [ ] Verify new work does not depend on deprecated names.

### Phase 1 verification

- [x] Run targeted server module tests. (S01: 8/8 pass)
- [ ] Run `yarn test`. (pending S02)
- [ ] Run `yarn lint`. (pending S02)
- [ ] Deploy early server rename changes before gateway integration milestones.

## Phase 2 - New Gateway Package Foundation (S03-S05)

### S03: Feature flags and env defaults

- [ ] Add v2 and shadow flags to server env validation.
- [ ] Add matching flags to new gateway env validation.
- [ ] Add env parsing tests for defaults and explicit values.
- [ ] Verify default behavior stays legacy-safe when flags are off.

### S04: Scaffold greenfield gateway package

- [ ] Create `packages/email-ingestion-gateway` package scaffold.
- [ ] Add package scripts, tsconfig, entrypoint, and baseline types.
- [ ] Add independent env module and health endpoint.
- [ ] Ensure workspace build/test scripts include new package.

### S05: Gateway runtime baseline

- [ ] Add structured logging and correlation scaffolding.
- [ ] Add readiness endpoint and runtime error boundaries.
- [ ] Add smoke/unit tests for bootstrap, env parsing, and health endpoints.

### Phase 2 verification

- [ ] Run package-level tests for new gateway.
- [ ] Run `yarn test`.
- [ ] Confirm import-guard check catches legacy imports.

## Phase 3 - Contracts and Persistence (S06-S09)

### S06: Canonical contracts and reason codes

- [ ] Add canonical outcomes and reason codes in server.
- [ ] Add equivalent constants in new gateway package.
- [ ] Ensure no runtime import from legacy package for shared constants.
- [ ] Add tests guarding completeness and naming stability.

### S07: Alias routing migration

- [ ] Create migration for recipient alias routing table.
- [ ] Add normalization strategy and active flag.
- [ ] Add uniqueness/indexes for efficient lookups.
- [ ] Register migration in `packages/migrations/src/run-pg-migrations.ts`.

### S08: Grants migration

- [ ] Create migration for ingest grants table with `jti` uniqueness.
- [ ] Include tenant binding, message binding, `expires_at`, `consumed_at`.
- [ ] Add lookup and expiry indexes.
- [ ] Register migration in migration runner.

### S09: Replay nonce and quarantine migrations

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
- [ ] Add triage indexes by reason_code, status, and date.
- [ ] Register migration(s) in runner.

### Phase 3 verification

- [ ] Run `yarn local:setup`.
- [ ] Run migration/integration tests for new tables.
- [ ] Validate uniqueness constraints and consume-once assumptions.

## Phase 4 - Server Control and Ingest Core (S10-S14)

### S10: Control provider

- [ ] Implement alias resolution and grant issuance in email-ingestion module.
- [ ] Include decision and audit metadata.
- [ ] Add tests for known/unknown/inactive alias flows.

### S11: Control GraphQL operation

- [ ] Add control operation typeDefs under email-ingestion naming.
- [ ] Add resolver wiring via injector.
- [ ] Enforce control-plane auth and role constraints.
- [ ] Add resolver success/auth-failure tests.
- [ ] Run GraphQL codegen.

### S12: Grant validation and single-use consume

- [ ] Implement strict validation: scope, tenant, message binding, expiry, unconsumed.
- [ ] Implement atomic consume-once behavior.
- [ ] Add negative tests for reused/expired/mismatched grant behavior.

### S13: Idempotency and dedup

- [ ] Implement idempotency key persistence and stable duplicate result behavior.
- [ ] Implement tenant-scoped dedup fingerprints.
- [ ] Persist dedup decisions for auditability.
- [ ] Add tests for duplicate handling and cross-tenant isolation.

### S14: Ingest GraphQL operation

- [ ] Add ingest operation typeDefs and resolver under email-ingestion module.
- [ ] Wire grant validation + idempotency + dedup + reason mapping.
- [ ] Add resolver tests for inserted/duplicate/quarantined/rejected outcomes.
- [ ] Run GraphQL codegen and resolve generated typing issues.

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
