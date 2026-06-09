# Multi-tenant Gmail Listener Prompt Plan

## Goal

Build the v2 multi-tenant ingestion flow from the approved architecture in safe, test-driven increments, while keeping the current listener path running until v2 is fully implemented, deployed, and validated.

## Inputs

- Architecture source: `docs/multi-tenant-gmail-listener/architecture-plan.md`
- Runtime reference: `docs/multi-tenant-gmail-listener/data-flow.md`
- Existing gateway service: `packages/gmail-listener/src/`
- Existing server module: `packages/server/src/modules/gmail-listener/`

## Non-negotiable constraints

1. Keep the current listener path operational throughout implementation.
2. No direct DB writes from gateway.
3. Server remains authoritative for tenant resolution and writes.
4. Use TDD in every step: failing tests first, then implementation.
5. Use Yarn only. Keep ESM imports with `.js` suffix.
6. If GraphQL schema changes, run `yarn generate`.
7. Favor small PR-sized steps with clear exit criteria.
8. When resolvers gain new injector dependencies, update resolver test injector mocks accordingly.

---

## Iteration Round 1: End-to-end Blueprint (Macro)

1. Foundation and safety rails
   1. Add feature flags and config defaults for parallel path + shadow mode.
   2. Define shared enums/types for outcomes, reason codes, and correlation IDs.
2. Persistence and contracts
   1. Add migrations for alias routing, ingest grants, replay nonces, and quarantine records.
   2. Extend GraphQL schema with control-plane and ingest-plane operations.
3. Server control plane
   1. Implement alias resolution + short-lived grant issuance.
   2. Add strong authorization and audit metadata.
4. Server ingest plane
   1. Validate grant single-use semantics and tenant binding.
   2. Add idempotency and dedup behavior.
   3. Persist inserts or quarantine outcomes with reason codes.
5. Gateway ingress plane
   1. Add Cloudflare request authenticity + replay checks.
   2. Add Cloudflare webhook endpoint in parallel to existing listener loop.
6. Gateway extraction and orchestration
   1. Parse MIME, enforce limits, build sender evidence.
   2. Call server control endpoint, then ingest endpoint.
   3. Handle retries, debug/error labeling, and shadow-mode logging.
7. Observability and operations
   1. Correlation IDs, structured logs, metrics, and alerts.
   2. Quarantine triage and reprocess workflow for ops.
8. Integration and rollout
   1. Cloudflare staging setup and smoke tests.
   2. Tenant-by-tenant cutover with rollback readiness.

---

## Iteration Round 2: Incremental Chunks

| Chunk | Outcome | Depends on | Test focus |
|---|---|---|---|
| C1 | Feature flags + shared contracts | none | env + type tests |
| C2 | DB structures in place | C1 | migration smoke + integration |
| C3 | Server control endpoint works | C2 | resolver/provider unit + integration |
| C4 | Server ingest endpoint works | C3 | grant/idempotency/dedup tests |
| C5 | Gateway auth-verified ingress endpoint | C1 | signature/replay unit tests |
| C6 | Gateway extraction + server orchestration | C4, C5 | gateway unit + contract integration |
| C7 | Shadow mode + coexistence with current listener | C6 | regression + dual-path tests |
| C8 | Cloudflare setup + deployment runbook | C7 | staging smoke checklist |
| C9 | Final hardening and wiring | C8 | full unit + integration + lint |

Chunk check:

1. Each chunk creates a usable, testable capability.
2. No chunk introduces a broad refactor without test guardrails first.
3. No chunk leaves disconnected code paths.

---

## Iteration Round 3: Right-sized Steps

This splits chunks into PR-sized steps that are small enough for safe TDD and large enough to move delivery.

1. S01: Add v2 feature flags and defaults in gateway/server environments + env tests.
2. S02: Add shared reason-code and outcome enums/constants (server + gateway).
3. S03: Add migration for alias routing table + indexes.
4. S04: Add migration for ingest grants (jti, expiry, consumed_at) + indexes.
5. S05: Add migration for replay nonce and quarantine tables.
6. S06: Add server provider skeleton for alias resolution and grant issuance with unit tests.
7. S07: Add GraphQL control operation typeDefs + resolver wiring + auth tests.
8. S08: Add server grant validator (single-use consume semantics) with unit tests.
9. S09: Add server idempotency key and dedup service behavior with tests.
10. S10: Add GraphQL ingest operation + resolver wiring + reason-code mapping tests.
11. S11: Add gateway Cloudflare signature/timestamp/nonce verifier module + tests.
12. S12: Add gateway Cloudflare webhook endpoint with route-specific auth and feature flag.
13. S13: Add MIME parsing/extraction pipeline with size/count limits and tests.
14. S14: Add gateway server client methods for control + ingest calls with retries.
15. S15: Wire gateway orchestration flow control -> extract -> ingest with shadow logging.
16. S16: Add observability wiring (correlation ID, structured logs, metrics hooks).
17. S17: Add server and gateway integration suites for happy path and adversarial cases.
18. S18: Add Cloudflare staging/deployment instructions and smoke-runbook artifacts.
19. S19: Final wiring and cleanup pass, ensure no orphan code and all flags documented.
20. S20: Full verification pass and release checklist.

---

## Right-size Review

What was split further and why:

1. Server ingest work was split into S08-S10 because single-use grant logic, idempotency/dedup, and resolver wiring are distinct risk areas.
2. Gateway ingress and extraction were split into S11-S13 because auth/replay mistakes and MIME parsing mistakes fail differently and need isolated tests.
3. Integration and deployment were split into S17-S18 so code correctness and cloud setup correctness can be validated independently.

Safety check:

1. Every step has explicit tests.
2. Every step builds on prior merged work.
3. No step introduces major cross-package changes without a narrow validation target.
4. Final steps explicitly wire and verify end-to-end behavior.

---

## Prompt Sequence For Code-generation LLM

How to use this section:

1. Run prompts in order.
2. Do not skip steps.
3. After each step: commit or checkpoint only if tests pass.
4. If a prompt changes GraphQL schema: run `yarn generate` before tests.
5. Keep current listener behavior untouched unless the prompt explicitly changes it.

### Prompt 01 - Feature flags and env safety

```text
You are implementing Step S01.
Assume no prior unmerged changes.

Goal:
Add v2 feature flags in gateway and server environment validation with safe defaults.

Tasks:
1. In packages/gmail-listener/src/environment.ts, add env keys for:
   - MULTI_TENANT_INGEST_V2_ENABLED (boolean, default false)
   - MULTI_TENANT_INGEST_SHADOW_MODE (boolean, default true when v2 is enabled)
2. In server environment validation, add corresponding flags for server-side gating.
3. Add or extend environment tests to verify defaults, explicit true/false parsing, and invalid values.
4. Ensure no runtime behavior changes yet.

TDD requirements:
1. Write failing tests first for env parsing.
2. Implement minimal code to pass.

Verification:
1. Run targeted environment tests.
2. Run yarn test.

Deliverables:
1. Code changes.
2. Test files.
3. Short note listing default values.
```

### Prompt 02 - Shared contracts for outcome and reason codes

```text
You are implementing Step S02. Step S01 is complete.

Goal:
Introduce shared enums/constants for ingest outcomes and reason codes in both gateway and server.

Tasks:
1. Add server-side typed constants for outcomes:
   - inserted, duplicate, quarantined, rejected
2. Add reason codes from architecture plan:
   - UNKNOWN_ALIAS, INVALID_AUTH, REPLAY_DETECTED, GRANT_INVALID, TENANT_MISMATCH,
     NO_DOCUMENTS, PARSE_ERROR, OVERSIZE_MESSAGE, TIMEOUT, TRANSIENT_UPSTREAM
3. Add equivalent gateway-side constants (or generated GraphQL enum mapping if already preferred).
4. Add unit tests that guard enum completeness and prevent accidental renames.

TDD requirements:
1. Write failing tests that assert the canonical set and naming.
2. Implement minimal code.

Verification:
1. Run targeted unit tests for new constants.
2. Run yarn test.
```

### Prompt 03 - Migration: alias routing table

```text
You are implementing Step S03. Steps S01-S02 are complete.

Goal:
Add DB support for alias-to-tenant authoritative resolution.

Tasks:
1. Create a new migration in packages/migrations/src/actions/ for alias routing records.
2. Include columns required for stable resolution and auditability:
   - recipient_alias (normalized)
   - tenant_id/owner_id reference
   - active flag
   - created_at, updated_at
3. Add uniqueness/indexes to support fast lookup and prevent duplicate active alias conflicts.
4. Register migration in packages/migrations/src/run-pg-migrations.ts.
5. Add migration smoke validation instructions in comments or test helper if migration tests exist.

TDD requirements:
1. Add a focused integration test (or migration verification helper) that validates schema assumptions.

Verification:
1. Run yarn local:setup.
2. Run targeted integration test if present.
```

### Prompt 04 - Migration: ingest grants table

```text
You are implementing Step S04. Prior steps are complete.

Goal:
Persist single-use, short-lived grants with replay-safe semantics.

Tasks:
1. Add migration for ingest grants table with fields:
   - jti (unique)
   - tenant binding
   - message binding hash/id
   - action scope
   - expires_at
   - consumed_at (nullable)
   - created_at
2. Add indexes for jti lookup and expiry cleanup operations.
3. Register migration in run-pg-migrations.ts.
4. Ensure schema supports atomic consume update patterns.

TDD requirements:
1. Add integration test or provider-level test scaffold proving a grant can transition unconsumed -> consumed exactly once.

Verification:
1. Run yarn local:setup.
2. Run yarn test:integration -- <new-test-pattern>.
```

### Prompt 05 - Migration: replay nonce and quarantine tables

```text
You are implementing Step S05.

Goal:
Persist replay-protection nonce records and quarantine records.

Tasks:
1. Add migration for replay nonce table with nonce uniqueness and expiry timestamp.
2. Add migration/table changes for quarantine records including:
   - reason_code
   - tenant_candidate
   - message identifiers
   - raw_message_hash
   - correlation_id
   - status
   - retry_count
   - created_at/updated_at
3. Add indexes to support ops triage queries by reason_code/date/status.
4. Register migration(s).

TDD requirements:
1. Add integration tests for uniqueness and basic insert/query behavior.

Verification:
1. Run yarn local:setup.
2. Run targeted integration tests.
```

### Prompt 06 - Server control provider

```text
You are implementing Step S06.

Goal:
Create server provider for alias resolution and ingest grant issuance.

Tasks:
1. Add a provider under packages/server/src/modules/gmail-listener/providers/.
2. Implement methods:
   - resolveAliasToTenant(input)
   - issueIngestGrant(input)
3. Include decision metadata (decision_id/audit_id/correlation_id passthrough).
4. Validate alias normalization and active-route rules.
5. Add unit tests for:
   - known alias
   - unknown alias
   - inactive alias
   - grant issuance payload shape

TDD requirements:
1. Write tests first with mocked TenantAwareDBClient and any context providers.
2. Ensure injector mocks include every new dependency.

Verification:
1. Run targeted provider tests.
2. Run yarn test.
```

### Prompt 07 - GraphQL control endpoint wiring

```text
You are implementing Step S07.

Goal:
Expose control-plane capability through GraphQL module.

Tasks:
1. Update packages/server/src/modules/gmail-listener/typeDefs/gmail-listener.graphql.ts:
   - add control operation input/output types
   - include correlation_id and metadata fields
2. Wire resolver in gmail-listener.resolver.ts using context.injector.
3. Enforce auth role constraints for control-plane caller.
4. Add resolver tests for success and auth failure.
5. If GraphQL schema changed, run yarn generate and fix generated type breakages.

TDD requirements:
1. Resolver tests first.

Verification:
1. Run yarn generate.
2. Run targeted resolver tests.
3. Run yarn test.
```

### Prompt 08 - Server grant validation and single-use consume

```text
You are implementing Step S08.

Goal:
Implement strict grant validation and consume-once semantics.

Tasks:
1. Add grant validation method(s) in server provider layer.
2. Validate:
   - signature or token structure (as used internally)
   - tenant binding
   - message binding
   - expiry
   - unconsumed state
3. Implement atomic consume behavior so only first valid use succeeds.
4. Add unit/integration tests for:
   - valid consume
   - second consume rejected
   - expired grant rejected
   - tenant mismatch rejected

TDD requirements:
1. Add failing tests for race/duplicate consume scenario.

Verification:
1. Run targeted tests.
2. Run yarn test:integration -- <pattern>.
```

### Prompt 09 - Server idempotency and dedup logic

```text
You are implementing Step S09.

Goal:
Add idempotent ingest behavior and tenant-scoped dedup.

Tasks:
1. Add idempotency key handling in ingest provider path.
2. Return stable prior result for repeated idempotency key.
3. Add dedup fingerprinting logic using tenant_id + message/document fingerprints.
4. Persist dedup decisions for auditability.
5. Add tests:
   - same key repeated returns same result
   - different key same payload follows dedup policy
   - cross-tenant keys do not collide

TDD requirements:
1. Tests first with deterministic fixtures.

Verification:
1. Run targeted provider tests.
2. Run yarn test.
```

### Prompt 10 - GraphQL ingest endpoint wiring and reason mapping

```text
You are implementing Step S10.

Goal:
Expose ingest-plane operation and map all failure outcomes to canonical reason codes.

Tasks:
1. Extend GraphQL typeDefs for ingest input/output.
2. Wire resolver to ingest provider with full validation flow.
3. Ensure outcomes map to canonical codes and status values.
4. Add resolver tests for:
   - inserted
   - duplicate
   - quarantined
   - rejected
5. Ensure audit metadata and correlation_id propagate.
6. Run yarn generate after schema updates.

TDD requirements:
1. Add failing resolver tests before implementation.

Verification:
1. Run yarn generate.
2. Run targeted tests.
3. Run yarn test.
```

### Prompt 11 - Gateway Cloudflare authenticity verifier

```text
You are implementing Step S11.

Goal:
Add request authenticity and replay checks for Cloudflare inbound requests.

Tasks:
1. Create gateway verifier module for signature/timestamp/nonce validation.
2. Add environment-backed config for:
   - signing secret or verifier key
   - allowed clock skew window
   - max request age
3. Add nonce replay integration interface (server-backed or gateway cache abstraction).
4. Add unit tests:
   - valid signature accepted
   - invalid signature rejected
   - stale timestamp rejected
   - reused nonce rejected

TDD requirements:
1. Write verifier tests first with fixed fixtures.

Verification:
1. Run targeted gateway unit tests.
2. Run yarn test.
```

### Prompt 12 - Gateway Cloudflare webhook endpoint

```text
You are implementing Step S12.

Goal:
Add a Cloudflare webhook endpoint in gateway without disturbing existing listener routes.

Tasks:
1. Extend packages/gmail-listener/src/index.ts with new route (for example /ingest/cloudflare).
2. Apply route-specific auth verification using the new verifier.
3. Keep existing API key auth for current operational endpoints.
4. Gate new route behind MULTI_TENANT_INGEST_V2_ENABLED flag.
5. Return structured response with correlation_id.
6. Add endpoint tests (happy path, unauthorized, disabled flag, malformed payload).

TDD requirements:
1. Add route tests first.

Verification:
1. Run targeted gateway tests.
2. Run yarn test.
```

### Prompt 13 - Gateway MIME parse and extraction pipeline

```text
You are implementing Step S13.

Goal:
Create reusable extraction pipeline for Cloudflare raw payload with limits enforcement.

Tasks:
1. Add parser module that extracts:
   - sender evidence
   - message metadata
   - candidate documents
2. Enforce MVP limits:
   - raw MIME <= 25 MB
   - attachment count <= 10
   - extracted docs total <= 20 MB
3. Map limit violations to canonical reason codes.
4. Reuse existing extraction helpers where possible to avoid duplicated logic.
5. Add tests for:
   - parse success
   - no documents
   - oversize message
   - too many attachments

TDD requirements:
1. Tests first using fixture messages.

Verification:
1. Run targeted gateway tests.
2. Run yarn test.
```

### Prompt 14 - Gateway server client for control and ingest

```text
You are implementing Step S14.

Goal:
Extend gateway server client to call new control and ingest operations with retry and idempotency.

Tasks:
1. Add typed GraphQL documents for control and ingest operations in packages/gmail-listener/src/server-requests.ts.
2. Include correlation_id and idempotency_key in requests.
3. Implement timeout and retry policy:
   - control: 3s, up to 2 retries
   - ingest: 10s, 1 retry for network/5xx only
4. Add tests with mocked fetch for retry, timeout, and response mapping behavior.
5. Run yarn generate if GraphQL operations change generated client types.

TDD requirements:
1. Write client retry tests first.

Verification:
1. Run yarn generate.
2. Run targeted gateway tests.
3. Run yarn test.
```

### Prompt 15 - Wire end-to-end gateway orchestration with shadow mode

```text
You are implementing Step S15.

Goal:
Wire gateway flow: verify -> control -> extract -> ingest, with shadow-mode logging and coexistence.

Tasks:
1. Add orchestration service that drives the full new path.
2. Respect flags:
   - when disabled: no behavior change
   - when enabled + shadow: execute decision flow and log outcome without enforced cutover side effects
3. Keep existing Gmail polling/listening path untouched.
4. Add tests for:
   - feature flag disabled path
   - enabled shadow mode path
   - error-to-quarantine mapping
   - fallback behavior

TDD requirements:
1. Integration-style tests first with mocked server client and parser.

Verification:
1. Run targeted gateway integration tests.
2. Run yarn test.
```

### Prompt 16 - Observability and audit propagation

```text
You are implementing Step S16.

Goal:
Add correlation and observability across gateway and server.

Tasks:
1. Ensure correlation_id is generated once and propagated across all control/ingest calls.
2. Add structured log fields:
   - correlation_id, decision_id, audit_id, reason_code, outcome, tenant_id (when known)
3. Add metrics hooks/counters for:
   - success
   - quarantined by reason_code
   - replay rejects
   - dedup hits
4. Add tests for log context propagation and metric event emission.

TDD requirements:
1. Add tests for correlation propagation first.

Verification:
1. Run targeted tests.
2. Run yarn test.
```

### Prompt 17 - Integration suites and adversarial tests

```text
You are implementing Step S17.

Goal:
Add high-confidence integration coverage for server and gateway.

Tasks:
1. Server integration tests:
   - control endpoint happy path
   - unknown alias -> quarantine reason
   - grant reuse rejection
   - tenant mismatch rejection
2. Gateway integration tests:
   - valid Cloudflare event end-to-end through mocked server
   - invalid signature
   - replay nonce
   - oversize parse failure
3. Add one cross-tenant adversarial test proving no cross-tenant insert.
4. Keep tests deterministic and isolated.

TDD requirements:
1. Build tests first, then implementation adjustments.

Verification:
1. Run yarn test:integration.
2. Run yarn test.
```

### Prompt 18 - Designated Cloudflare setup and deployment instructions

```text
You are implementing Step S18.

Goal:
Produce deployment-grade setup instructions and smoke checks for Cloudflare integration.

Designated setup/integration instructions (required):
1. Create a new runbook doc under docs/multi-tenant-gmail-listener/ with:
   - Cloudflare Email Routing setup for tenant aliases
   - Destination setup to gateway endpoint
   - Header/signature scheme configuration
   - Secret management and rotation procedure
   - Optional mTLS setup path
   - IP allowlist update process
2. Include environment variable mapping table for gateway/server.
3. Add staging smoke checklist:
   - valid message processed
   - unknown alias quarantined
   - invalid signature rejected
   - replay attempt rejected
4. Add rollback instructions to route traffic back to legacy listener path.
5. Add on-call troubleshooting section with reason_code-based triage.

Verification:
1. Ensure runbook is complete and internally consistent.
2. Link runbook from architecture-plan.md and this prompt-plan.md.
```

### Prompt 19 - Final wiring and orphan-code cleanup

```text
You are implementing Step S19.

Goal:
Ensure all introduced components are fully wired and no dead code remains.

Tasks:
1. Trace all new modules and verify they are reachable from runtime entrypoints.
2. Remove or complete any TODO scaffolding created in earlier steps.
3. Verify feature flags have documented behavior and defaults.
4. Ensure no newly added types/fields are unused or disconnected.
5. Confirm existing listener operational flow still starts and health endpoint remains functional.

TDD requirements:
1. Add any missing regression tests discovered during wiring review.

Verification:
1. Run targeted tests.
2. Run yarn test.
3. Run yarn lint.
```

### Prompt 20 - Final verification and release checklist

```text
You are implementing Step S20.

Goal:
Run final verification and produce release readiness notes.

Tasks:
1. Run full validation sequence:
   - yarn generate
   - yarn lint
   - yarn test
   - yarn test:integration
2. Capture and fix any failing tests introduced by the new flow.
3. Produce a concise release checklist in docs/multi-tenant-gmail-listener/:
   - feature flags and defaults
   - migration order and rollback notes
   - staging sign-off checklist
   - production cutover checklist
4. Confirm shadow mode telemetry is available for tenant-by-tenant cutover.

Definition of done:
1. All checks pass.
2. No orphaned code.
3. Cutover and rollback paths are documented.
```

---

## Suggested implementation cadence

1. Do one prompt per PR.
2. Merge only green builds.
3. Keep shadow mode enabled during early tenant onboarding.
4. Promote to enforced mode only after stable integration and security test signal.
