# Multi-tenant Email Ingestion Prompt Plan

## Goal

Build the v2 Cloudflare -> Gateway -> Server ingestion flow in safe, test-driven increments while:

1. Keeping the current `gmail-listener` service active until v2 is fully validated.
2. Moving all new development to new names and new modules.
3. Avoiding any shared runtime code between legacy and v2 gateway services.

## Strategy Update (Locked)

1. New gateway service is greenfield under `packages/email-ingestion-gateway`.
2. Do not share code between `packages/gmail-listener` and `packages/email-ingestion-gateway`.
3. If v2 needs logic similar to legacy listener, duplicate and adapt it in the new package.
4. Server-side shared ingestion logic must be renamed early to `email-ingestion` naming.
5. Legacy `gmail-listener` remains operational during rollout and can be retired later.

## Inputs

- Architecture source: `docs/multi-tenant-gmail-listener/architecture-plan.md`
- Runtime flow source: `docs/multi-tenant-gmail-listener/data-flow.md`
- Legacy listener (reference only): `packages/gmail-listener/src/`
- New gateway target: `packages/email-ingestion-gateway/`
- Server target module naming: `packages/server/src/modules/email-ingestion/`

## Non-negotiable constraints

1. No direct DB writes from gateway.
2. Server remains authoritative for tenant resolution and inserts.
3. TDD for every step: failing tests first, then implementation.
4. Use Yarn only.
5. Use ESM imports with `.js` suffix in TS source.
6. Run `yarn generate` after GraphQL schema changes.
7. Keep steps PR-sized and independently verifiable.
8. When resolver dependencies change, update injector mocks in tests.
9. Do not import runtime code from `packages/gmail-listener` into
   `packages/email-ingestion-gateway`.
10. Keep legacy listener behavior stable until cutover decision.

---

## Iteration Round 1: Macro Blueprint

1. Early server naming migration
   1. Introduce `email-ingestion` server module naming and compatibility wiring.
   2. Deploy this early so gateway integration later binds to stable new names.
2. Greenfield gateway foundation
   1. Scaffold `packages/email-ingestion-gateway` with independent runtime and tests.
   2. Add env validation, health endpoint, and feature flags.
3. Persistence and contracts
   1. Add migrations for alias routing, grants, replay nonces, and quarantine.
   2. Add control-plane and ingest-plane contracts in server GraphQL.
4. Server control and ingest core
   1. Alias resolution and grant issuance.
   2. Grant validation, single-use consume, idempotency, dedup, and quarantine outcomes.
5. Gateway ingestion pipeline
   1. Cloudflare authenticity and replay verification.
   2. MIME parsing and extraction with strict limits.
   3. Control call then ingest call orchestration.
6. Observability and rollout
   1. Correlation IDs, structured logs, and metrics.
   2. Shadow mode, parity checks, and tenant-by-tenant cutover.
7. Cloudflare integration and ops readiness
   1. Staging setup, smoke tests, and rollback runbook.

---

## Iteration Round 2: Incremental Chunks

| Chunk | Outcome                                       | Depends on | Test focus                           |
| ----- | --------------------------------------------- | ---------- | ------------------------------------ |
| C1    | Server naming migration to `email-ingestion`  | none       | schema/resolver compatibility        |
| C2    | Greenfield gateway package scaffolded         | C1         | package bootstrap + env tests        |
| C3    | Shared contracts + reason/outcome enums       | C1         | unit contract tests                  |
| C4    | DB structures in place                        | C3         | migration smoke + integration        |
| C5    | Server control endpoint works                 | C4         | provider/resolver unit + integration |
| C6    | Server ingest endpoint works                  | C5         | grant/idempotency/dedup tests        |
| C7    | Gateway authenticity + ingress endpoint works | C2, C3     | signature/replay/route tests         |
| C8    | Gateway extraction + orchestration works      | C6, C7     | gateway unit + integration           |
| C9    | Observability + shadow mode complete          | C8         | dual-path metrics/log tests          |
| C10   | Cloudflare runbook + rollout hardening        | C9         | staging smoke checklist              |

Chunk check:

1. Each chunk is deployable behind flags.
2. No chunk requires sharing code with legacy listener.
3. Naming migration is front-loaded before gateway integration.

---

## Iteration Round 3: Right-sized Steps

1. S01: Create `email-ingestion` server module namespace and compatibility bridge.
2. S02: Move/duplicate server providers/resolvers under new names and keep old API compatibility.
3. S03: Add server and gateway feature flags and env tests.
4. S04: Scaffold new package `packages/email-ingestion-gateway`.
5. S05: Add basic gateway runtime: health route, logging, config, and test harness.
6. S06: Add shared reason/outcome constants in server and new gateway (no legacy imports).
7. S07: Add migration for alias routing table + indexes.
8. S08: Add migration for grants table (jti, expiry, consumed_at).
9. S09: Add migration for replay nonce and quarantine tables.
10. S10: Implement server control provider (alias resolution + grant issuance).
11. S11: Implement control GraphQL operation in `email-ingestion` module.
12. S12: Implement grant validation + single-use consume provider logic.
13. S13: Implement idempotency + dedup in ingest flow.
14. S14: Implement ingest GraphQL operation and reason-code mapping.
15. S15: Implement gateway Cloudflare authenticity verifier.
16. S16: Implement gateway webhook endpoint and payload validation.
17. S17: Implement gateway extraction pipeline with limits (duplicate/adapt, do not import legacy
    code).
18. S18: Implement gateway server client and control->ingest orchestration.
19. S19: Add observability, shadow mode, and adversarial integration suites.
20. S20: Add Cloudflare setup runbook, final wiring review, and release checklist.

---

## Right-size Review

Why this sizing is safe and effective:

1. Server rename is first, so naming is stable before gateway integration lands.
2. Greenfield gateway package avoids hidden coupling to legacy listener internals.
3. Migrations are completed before core control/ingest business logic.
4. Security-critical checks (signature, replay, grant consume) are isolated and tested early.
5. Orchestration happens only after server contracts and gateway extraction are stable.
6. Final step focuses on deployment and rollback readiness, not new core logic.

---

## Prompt Sequence For Code-generation LLM

How to use this section:

1. Run prompts in order.
2. Do not skip steps.
3. One prompt per PR.
4. If GraphQL changes: run `yarn generate` before tests.
5. Do not import runtime code from `packages/gmail-listener` into
   `packages/email-ingestion-gateway`.

### Prompt 01 - Early server module renaming (compatibility-safe)

```text
You are implementing Step S01.

Goal:
Introduce new server naming under packages/server/src/modules/email-ingestion/ early, while preserving compatibility.

Tasks:
1. Create new module structure under packages/server/src/modules/email-ingestion/.
2. Move or duplicate gmail-listener server logic into email-ingestion naming.
3. Keep legacy compatibility by preserving existing GraphQL behavior for current callers.
4. Add tests proving old behavior still works and new module compiles/runs.

TDD requirements:
1. Write failing tests for compatibility and new module wiring first.

Verification:
1. Run targeted server module tests.
2. Run yarn test.
3. Run yarn lint.
```

### Prompt 02 - Server API naming bridge and docs alignment

```text
You are implementing Step S02.

Goal:
Complete internal server naming migration for shared ingestion logic before gateway integration work starts.

Tasks:
1. Rename provider/resolver/service identifiers from gmail-listener naming to email-ingestion naming.
2. Keep backward-compatible API surface where needed.
3. Update module docs/comments and tests for new naming.
4. Ensure no references from new code to deprecated names except explicit compatibility adapters.

TDD requirements:
1. Add tests that fail when old identifiers are required by new code.

Verification:
1. Run server unit tests.
2. Run yarn test.
```

### Prompt 03 - Feature flags and env defaults

```text
You are implementing Step S03.

Goal:
Add v2 flags and defaults in server and new gateway environments.

Tasks:
1. Add feature flags for v2 enablement and shadow mode in server env validation.
2. Add matching flags in new gateway env validation.
3. Add env tests for defaults and explicit values.
4. Keep runtime behavior legacy-safe when flags are off.

TDD requirements:
1. Failing env tests first.

Verification:
1. Run targeted env tests.
2. Run yarn test.
```

### Prompt 04 - Create greenfield gateway package

```text
You are implementing Step S04.

Goal:
Create packages/email-ingestion-gateway as an independent service package.

Tasks:
1. Add package scaffold with package.json, tsconfig, and src entrypoint.
2. Add independent env module, types, and minimal health endpoint.
3. Ensure workspace build/test scripts can include this package.
4. Do not import runtime modules from packages/gmail-listener.

TDD requirements:
1. Add smoke tests for package bootstrap and env parsing.

Verification:
1. Run package typecheck/build scripts.
2. Run yarn test.
```

### Prompt 05 - Gateway runtime baseline

```text
You are implementing Step S05.

Goal:
Establish baseline runtime in new gateway package.

Tasks:
1. Add structured logging and request correlation scaffolding.
2. Add health and readiness endpoints.
3. Add robust request parsing/error boundaries.
4. Add tests for health/readiness and failure handling.

TDD requirements:
1. Write endpoint tests first.

Verification:
1. Run targeted gateway tests.
2. Run yarn test.
```

### Prompt 06 - Shared contracts and canonical codes

```text
You are implementing Step S06.

Goal:
Define canonical reason/outcome contracts in server and new gateway with no legacy runtime sharing.

Tasks:
1. Add constants/enums for outcomes and reason codes in server and new gateway.
2. Ensure naming is email-ingestion oriented.
3. Add tests guarding completeness and stability.
4. Do not import from legacy gateway package; duplicate definitions if needed.

TDD requirements:
1. Failing contract tests first.

Verification:
1. Run targeted unit tests.
2. Run yarn test.
```

### Prompt 07 - Migration: alias routing table

```text
You are implementing Step S07.

Goal:
Add DB support for recipient_alias -> tenant resolution.

Tasks:
1. Add migration for alias routing table with normalization-friendly design.
2. Add indexes/constraints for active lookup and uniqueness.
3. Register migration in run-pg-migrations.ts.
4. Add migration verification test/check.

TDD requirements:
1. Add focused schema/behavior validation test.

Verification:
1. Run yarn local:setup.
2. Run integration checks for alias lookup assumptions.
```

### Prompt 08 - Migration: grants table

```text
You are implementing Step S08.

Goal:
Persist single-use, short-lived ingest grants.

Tasks:
1. Add grants table migration with jti uniqueness and consume fields.
2. Include tenant/message binding and expiry fields.
3. Add indexes for lookup and expiry operations.
4. Register migration.

TDD requirements:
1. Add test scaffold proving one-time consume semantics.

Verification:
1. Run yarn local:setup.
2. Run relevant integration tests.
```

### Prompt 09 - Migration: replay nonce and quarantine

```text
You are implementing Step S09.

Goal:
Persist replay protection and quarantine records.

Tasks:
1. Add replay nonce table with uniqueness in active window.
2. Add quarantine table with required fields and triage indexes.
3. Register migration(s).
4. Add integration checks for unique replay nonce and quarantine insert/query paths.

TDD requirements:
1. Write integration checks first.

Verification:
1. Run yarn local:setup.
2. Run migration/integration tests.
```

### Prompt 10 - Server control provider

```text
You are implementing Step S10.

Goal:
Implement control-plane provider in email-ingestion server module.

Tasks:
1. Add provider for alias resolution and grant issuance.
2. Include decision/audit metadata passthrough.
3. Add tests for known/unknown/inactive alias and grant output.
4. Ensure naming uses email-ingestion terminology.

TDD requirements:
1. Failing provider tests first.

Verification:
1. Run targeted provider tests.
2. Run yarn test.
```

### Prompt 11 - Server control GraphQL operation

```text
You are implementing Step S11.

Goal:
Expose control endpoint through email-ingestion GraphQL module.

Tasks:
1. Add control operation types and resolver wiring in email-ingestion module.
2. Apply auth/role constraints for control identity.
3. Add resolver tests for success and auth failure.
4. Run yarn generate and resolve typing issues.

TDD requirements:
1. Resolver tests first.

Verification:
1. Run yarn generate.
2. Run targeted resolver tests.
3. Run yarn test.
```

### Prompt 12 - Server grant validation and consume-once

```text
You are implementing Step S12.

Goal:
Implement strict grant validation and atomic single-use consume semantics.

Tasks:
1. Validate scope, tenant, message binding, expiry, and unconsumed state.
2. Add atomic consume update.
3. Add tests for expired/reused/mismatched grant failure paths.

TDD requirements:
1. Negative tests first.

Verification:
1. Run targeted tests.
2. Run yarn test:integration -- <pattern>.
```

### Prompt 13 - Server idempotency and dedup

```text
You are implementing Step S13.

Goal:
Add idempotency and tenant-scoped dedup in ingest path.

Tasks:
1. Implement idempotency_key storage/lookup logic.
2. Return stable duplicate outcomes.
3. Add tenant-scoped dedup fingerprints and persistence.
4. Add tests for duplicate behavior and cross-tenant isolation.

TDD requirements:
1. Failing idempotency tests first.

Verification:
1. Run targeted provider tests.
2. Run yarn test.
```

### Prompt 14 - Server ingest GraphQL operation

```text
You are implementing Step S14.

Goal:
Expose ingest endpoint through email-ingestion GraphQL module.

Tasks:
1. Add ingest operation input/output types and resolver.
2. Wire grant validation, idempotency, dedup, and reason-code mapping.
3. Add resolver tests for inserted/duplicate/quarantined/rejected outcomes.
4. Run yarn generate and fix generated typing errors.

TDD requirements:
1. Resolver tests first.

Verification:
1. Run yarn generate.
2. Run targeted tests.
3. Run yarn test.
```

### Prompt 15 - Gateway Cloudflare authenticity verifier

```text
You are implementing Step S15 in packages/email-ingestion-gateway.

Goal:
Add authenticity and replay checks for Cloudflare requests.

Tasks:
1. Implement signature or mTLS verification hooks.
2. Add IP allowlist check as defense-in-depth.
3. Validate timestamp window and nonce replay.
4. Add tests for valid/invalid/stale/replayed inputs.

Constraints:
1. Do not import verifier code from packages/gmail-listener.
2. Duplicate and adapt logic where needed.

TDD requirements:
1. Verifier tests first.

Verification:
1. Run targeted gateway tests.
2. Run yarn test.
```

### Prompt 16 - Gateway webhook endpoint

```text
You are implementing Step S16 in packages/email-ingestion-gateway.

Goal:
Add Cloudflare webhook endpoint with strict input validation.

Tasks:
1. Add POST ingress route for Cloudflare events.
2. Wire authenticity verifier and replay checks.
3. Enforce feature-flag gating.
4. Return structured outcome with correlation_id.
5. Add route tests for malformed/auth-failure/disabled-flag behavior.

Constraints:
1. Do not import route handling code from packages/gmail-listener.

TDD requirements:
1. Endpoint tests first.

Verification:
1. Run targeted gateway tests.
2. Run yarn test.
```

### Prompt 17 - Gateway extraction pipeline (duplicate, do not share)

```text
You are implementing Step S17 in packages/email-ingestion-gateway.

Goal:
Implement MIME extraction pipeline with limits and deterministic reason codes.

Tasks:
1. Build extraction for sender evidence + candidate documents.
2. Enforce limits: 25MB raw MIME, 10 attachments, 20MB extracted docs total.
3. Map failures to NO_DOCUMENTS, PARSE_ERROR, OVERSIZE_MESSAGE.
4. Add tests for boundary and failure cases.

Constraints:
1. Do not import extraction helpers from packages/gmail-listener.
2. If similar logic exists in legacy code, duplicate and adapt in v2 package.

TDD requirements:
1. Failing extraction tests first.

Verification:
1. Run targeted gateway tests.
2. Run yarn test.
```

### Prompt 18 - Gateway control->ingest orchestration

```text
You are implementing Step S18 in packages/email-ingestion-gateway.

Goal:
Call server control endpoint then ingest endpoint with retries and idempotency.

Tasks:
1. Add GraphQL client operations for control and ingest.
2. Include correlation_id and idempotency_key in requests.
3. Implement timeout/retry policy:
   - control: 3s, up to 2 retries with backoff
   - ingest: 10s, 1 retry for network/5xx
4. Add tests for retry matrix and outcome mapping.
5. Run yarn generate if operation typings are generated.

TDD requirements:
1. Retry and mapping tests first.

Verification:
1. Run yarn generate (if needed).
2. Run targeted gateway tests.
3. Run yarn test.
```

### Prompt 19 - Observability, shadow mode, and adversarial integration

```text
You are implementing Step S19.

Goal:
Complete observability and dual-path safety checks before rollout.

Tasks:
1. Propagate correlation_id across gateway and server calls.
2. Add structured logs and metrics for reason_code/outcome/replay/dedup.
3. Implement shadow mode behavior while legacy listener remains active.
4. Add integration and adversarial tests:
   - unknown alias
   - invalid auth
   - replay attempts
   - grant reuse
   - tenant mismatch
   - cross-tenant insertion prevention

TDD requirements:
1. Integration tests first, then implementation hardening.

Verification:
1. Run yarn test.
2. Run yarn test:integration.
```

### Prompt 20 - Designated Cloudflare setup, final wiring, and release checklist

```text
You are implementing Step S20.

Goal:
Finish deployment readiness with explicit Cloudflare setup instructions and final no-orphan wiring pass.

Tasks:
1. Create/update runbook docs under docs/multi-tenant-gmail-listener/ including:
   - Cloudflare routing setup
   - destination gateway config
   - secret management and rotation
   - optional mTLS path
   - IP allowlist update process
   - staging smoke tests (valid, invalid signature, replay, unknown alias)
   - rollback to legacy listener path
2. Verify no orphaned code in new server module and new gateway package.
3. Ensure compatibility path for legacy listener remains operational.
4. Run final validation sequence:
   - yarn generate
   - yarn lint
   - yarn test
   - yarn test:integration
5. Produce release checklist with cutover and rollback criteria.

Definition of done:
1. All tests and lint are green.
2. New naming is deployed in server before gateway cutover.
3. No runtime code sharing exists between legacy and new gateway packages.
```

---

## Suggested Cadence

1. Prompts 01-03: naming and guardrails first, deploy early.
2. Prompts 04-09: gateway scaffold + migrations foundation.
3. Prompts 10-14: server control/ingest core complete.
4. Prompts 15-19: gateway integration + security hardening.
5. Prompt 20: deployment readiness and cutover controls.

## Explicit Anti-coupling Rule

Before merging any v2 gateway PR:

1. Verify no runtime imports from `packages/gmail-listener` into `packages/email-ingestion-gateway`.
2. If needed logic resembles legacy code, duplicate and adapt it locally in v2 package.
3. Keep shared behavior alignment via tests and contracts, not shared runtime modules.
