## Multi-Business Server Refactor Blueprint

### Blueprint

1. Stabilize with tests before behavior changes.
2. Introduce scope primitives first, then wire them through auth.
3. Add database and RLS capabilities before module migrations.
4. Hard-cut GraphQL server contract after scope plumbing is stable.
5. Migrate writes first (strict single target), then reads (default all accessible).
6. Use a shared scope helper to avoid per-module authorization drift.
7. Finish with cache isolation hardening and full verification gates.

### Chunking Iterations

1. Iteration 1 (macro chunks): auth model, scope transport, RLS/session, GraphQL contract, module
   migrations, hardening.
2. Iteration 2 (implementation chunks): 18 chunks from baseline tests through final wiring.
3. Iteration 3 (right-sized safe steps): 15 test-first steps, each deployable and integrated, no
   orphan abstractions.

### Final Right-Sized Steps

1. Baseline guard tests.
2. Auth scope types.
3. Membership provider expansion.
4. Header scope parser.
5. Auth context integration.
6. Header/args precedence transport.
7. RLS migration.
8. Tenant DB client session propagation.
9. UserContext hard cut.
10. Shared scope helper plus first consumer.
11. Charges migration.
12. Reports migration.
13. Ledger migration.
14. Salaries plus admin-context migration.
15. Cache isolation, full wiring, release validation.

### Prompt 01: Baseline Guardrails

```text
You are implementing Step 1 of a multi-business tenancy migration in a Yarn Berry monorepo.

Goal:
Create a safety baseline before behavior changes.

Context files:
- [packages/server/src/modules/auth/providers/auth-context.provider.ts](packages/server/src/modules/auth/providers/auth-context.provider.ts)
- [packages/server/src/modules/app-providers/tenant-db-client.ts](packages/server/src/modules/app-providers/tenant-db-client.ts)
- [packages/server/src/modules/common/resolvers/user-context.resolver.ts](packages/server/src/modules/common/resolvers/user-context.resolver.ts)

Tasks:
1. Add focused tests that lock current auth rejection behavior, tenant DB context requirements, and current userContext resolver invariants.
2. Do not change runtime behavior yet.
3. Keep tests small and descriptive; use existing test patterns.

Validation:
- Run targeted server tests for changed files.
- Ensure no lint regressions in touched files.

Output:
Summary of tests added and why each protects the migration.
```

### Prompt 02: Add Auth Scope Types

```text
You are implementing Step 2. Assume Step 1 is merged.

Goal:
Introduce membership and request-scope types without changing behavior.

Context files:
- [packages/server/src/shared/types/auth.ts](packages/server/src/shared/types/auth.ts)
- [packages/server/src/modules/auth/providers/auth-context.provider.ts](packages/server/src/modules/auth/providers/auth-context.provider.ts)

Tasks:
1. Add explicit types for business membership and authorized read scope.
2. Add adapter helpers so existing code still compiles during transition.
3. Add unit tests for type-shaping helper functions.

Constraints:
- Keep external runtime behavior unchanged.
- No resolver/provider migration in this step.

Validation:
Run targeted tests and TypeScript checks for the server package.
```

### Prompt 03: Expand Membership Provider

```text
You are implementing Step 3. Assume Steps 1-2 are merged.

Goal:
Fetch all business memberships for a user instead of relying on single-row behavior.

Context files:
- [packages/server/src/modules/auth/providers/business-users.provider.ts](packages/server/src/modules/auth/providers/business-users.provider.ts)
- [packages/server/src/modules/auth/providers/auth-context.provider.ts](packages/server/src/modules/auth/providers/auth-context.provider.ts)

Tasks:
1. Add provider methods that return all memberships for an authenticated user.
2. Preserve existing method compatibility where still needed.
3. Add provider-level tests for no-membership, one-membership, multi-membership cases.

Validation:
Run provider tests and verify existing call sites still compile.
```

### Prompt 04: Add Header Scope Parser

```text
You are implementing Step 4. Assume Steps 1-3 are merged.

Goal:
Create a robust parser for request-level business scope header.

Context files:
- [packages/server/src/plugins/auth-plugin.ts](packages/server/src/plugins/auth-plugin.ts)
- [packages/server/src/shared/types/auth.ts](packages/server/src/shared/types/auth.ts)

Tasks:
1. Implement parser utility for comma-separated business IDs from request header.
2. Normalize whitespace and duplicates.
3. Return typed validation errors for malformed IDs.
4. Add unit tests for valid, empty, malformed, duplicate, and mixed input cases.

Constraints:
Do not wire parser into auth decisions yet.

Validation:
Run parser unit tests only; no behavior change outside parser layer.
```

### Prompt 05: Integrate Auth Context Scope

```text
You are implementing Step 5. Assume Steps 1-4 are merged.

Goal:
Auth context should resolve full memberships and default read scope to all accessible businesses.

Context files:
- [packages/server/src/modules/auth/providers/auth-context.provider.ts](packages/server/src/modules/auth/providers/auth-context.provider.ts)
- [packages/server/src/modules/auth/providers/business-users.provider.ts](packages/server/src/modules/auth/providers/business-users.provider.ts)
- [packages/server/src/shared/types/auth.ts](packages/server/src/shared/types/auth.ts)

Tasks:
1. Replace single-membership mapping with full membership resolution.
2. Apply requested header scope as a validated subset of memberships.
3. Reject out-of-membership requested scope.
4. Add integration-style provider tests for default-all and subset validation.

Validation:
Run auth provider tests and ensure unauthorized flows still fail correctly.
```

### Prompt 06: Add Header vs Args Precedence

```text
You are implementing Step 6. Assume Steps 1-5 are merged.

Goal:
Define and test request-scope precedence across transport layers.

Precedence rule:
GraphQL args scope (if provided) narrows the request; otherwise use header scope; if neither exists, use all accessible businesses.

Context files:
- [packages/server/src/plugins/auth-plugin.ts](packages/server/src/plugins/auth-plugin.ts)
- [packages/server/src/modules/common/resolvers/user-context.resolver.ts](packages/server/src/modules/common/resolvers/user-context.resolver.ts)

Tasks:
1. Add transport plumbing for scope args metadata to resolver context.
2. Implement precedence tests for args over header, header over default-all.
3. Keep scope authorization checks centralized and reusable.

Validation:
Run targeted resolver/context tests.
```

### Prompt 07: RLS Migration for Multi-Business Scope

```text
You are implementing Step 7. Assume Steps 1-6 are merged.

Goal:
Enable multi-business read scope in DB policy layer while preserving strict write targeting.

Context files:
- [packages/migrations](packages/migrations)

Tasks:
1. Add migration(s) for helper function(s) reading current request business scope from session settings.
2. Update relevant RLS policies to use scope arrays for reads.
3. Keep writes constrained to explicit single target business semantics.
4. Add migration verification tests/assertions where existing project patterns allow.

Validation:
Run migration verification checks and related integration tests.
```

### Prompt 08: Tenant DB Client Session Wiring

```text
You are implementing Step 8. Assume Steps 1-7 are merged.

Goal:
Set read scope and write target into DB session context for every operation.

Context files:
- [packages/server/src/modules/app-providers/tenant-db-client.ts](packages/server/src/modules/app-providers/tenant-db-client.ts)
- [packages/server/src/shared/types/auth.ts](packages/server/src/shared/types/auth.ts)

Tasks:
1. Add session-setting logic for read business scope and write target business.
2. Ensure values are propagated in nested transactions and reset safely.
3. Add tests for missing auth, invalid scope, valid scope propagation, nested transaction behavior.

Validation:
Run tenant DB client tests and any affected integration tests.
```

### Prompt 09: Hard-Cut UserContext Contract

```text
You are implementing Step 9. Assume Steps 1-8 are merged.

Goal:
Replace single adminBusinessId userContext output with multi-business-aware fields.

Context files:
- [packages/server/src/modules/common/typeDefs/user-context.graphql.ts](packages/server/src/modules/common/typeDefs/user-context.graphql.ts)
- [packages/server/src/modules/common/resolvers/user-context.resolver.ts](packages/server/src/modules/common/resolvers/user-context.resolver.ts)

Tasks:
1. Update GraphQL schema for memberships and active read scope fields.
2. Update resolver payload accordingly.
3. Remove legacy adminBusinessId response field from server contract.
4. Add resolver/schema tests for new shape and authorization behavior.

Validation:
Run GraphQL code generation and targeted tests for userContext.
```

### Prompt 10: Shared Scope Helper and First Consumer

```text
You are implementing Step 10. Assume Steps 1-9 are merged.

Goal:
Create one reusable scope helper/provider and apply it to a low-risk first consumer.

Context files:
- [packages/server/src/modules/financial-entities/resolvers/businesses.resolver.ts](packages/server/src/modules/financial-entities/resolvers/businesses.resolver.ts)
- [packages/server/src/modules/financial-entities/providers/businesses.provider.ts](packages/server/src/modules/financial-entities/providers/businesses.provider.ts)

Tasks:
1. Implement shared scope resolution helper: authorized scope, requested narrowing, and write target validation.
2. Integrate helper into businesses resolver/provider flow as reference implementation.
3. Add tests proving default-all, narrowed scope, and out-of-scope rejection.

Validation:
Run financial-entities tests plus any helper unit tests.
```

### Prompt 11: Charges Migration

```text
You are implementing Step 11. Assume Steps 1-10 are merged.

Goal:
Migrate charges module to explicit write target and scoped reads.

Context files:
- [packages/server/src/modules/charges/resolvers/financial-charges.resolver.ts](packages/server/src/modules/charges/resolvers/financial-charges.resolver.ts)
- [packages/server/src/modules/charges/resolvers/charges.resolver.ts](packages/server/src/modules/charges/resolvers/charges.resolver.ts)

Tasks:
1. Remove fallback-to-admin-context owner behavior in writes.
2. Require explicit write target and validate against membership.
3. Move reads to default-all scope unless narrowed by args/header precedence.
4. Add integration tests for multi-business reads and write authorization failures.

Validation:
Run charges module tests and affected integration tests.
```

### Prompt 12: Reports Migration

```text
You are implementing Step 12. Assume Steps 1-11 are merged.

Goal:
Apply shared scoped-read behavior to reports entry points.

Context files:
- [packages/server/src/modules/reports/resolvers/annual-revenue.resover.ts](packages/server/src/modules/reports/resolvers/annual-revenue.resover.ts)
- [packages/server/src/modules/reports/resolvers/shaam6111.resolver.ts](packages/server/src/modules/reports/resolvers/shaam6111.resolver.ts)
- [packages/server/src/modules/reports/resolvers/reports.resolver.ts](packages/server/src/modules/reports/resolvers/reports.resolver.ts)

Tasks:
1. Replace single-business default assumptions with shared scope helper.
2. Ensure explicit args narrow scope, not broaden it.
3. Add tests for cross-business aggregation and scoped narrowing correctness.

Validation:
Run reports tests and related integration tests.
```

### Prompt 13: Ledger Migration

```text
You are implementing Step 13. Assume Steps 1-12 are merged.

Goal:
Migrate ledger entry-point resolvers to explicit targeting for writes and scoped defaults for reads.

Context files:
- [packages/server/src/modules/ledger/resolvers/ledger.resolver.ts](packages/server/src/modules/ledger/resolvers/ledger.resolver.ts)
- [packages/server/src/modules/ledger/providers/ledger.provider.ts](packages/server/src/modules/ledger/providers/ledger.provider.ts)

Tasks:
1. Remove implicit owner resolution from admin context in ledger entry points.
2. Pass resolved scope/target explicitly into provider methods.
3. Keep internal helper behavior stable where possible by adapting at boundaries first.
4. Add high-value integration tests for multi-business read and invalid write target rejection.

Validation:
Run ledger tests and relevant integration suites.
```

### Prompt 14: Salaries and Admin Context Migration

```text
You are implementing Step 14. Assume Steps 1-13 are merged.

Goal:
Complete salaries module migration and remove remaining single-business assumptions in admin context usage.

Context files:
- [packages/server/src/modules/salaries/resolvers/salaries.resolvers.ts](packages/server/src/modules/salaries/resolvers/salaries.resolvers.ts)
- [packages/server/src/modules/admin-context/providers/admin-context.provider.ts](packages/server/src/modules/admin-context/providers/admin-context.provider.ts)

Tasks:
1. Enforce explicit write target in salaries writes.
2. Use shared scoped-read logic for salaries reads.
3. Refactor admin context provider methods that assume one business owner context.
4. Add tests for salaries and admin-context edge cases under multi-membership users.

Validation:
Run salaries and admin-context tests plus affected integrations.
```

### Prompt 15: Cache Isolation and Final Wiring

```text
You are implementing Step 15. Assume Steps 1-14 are merged.

Goal:
Finalize wiring, close tenant-isolation risks, and validate release readiness.

Context files:
- [packages/server/src/__tests__/cache-isolation.integration.test.ts](packages/server/src/__tests__/cache-isolation.integration.test.ts)
- [packages/server/src/modules/financial-entities/providers/businesses.provider.ts](packages/server/src/modules/financial-entities/providers/businesses.provider.ts)
- [docs/architecture/provider-cache-patterns.md](docs/architecture/provider-cache-patterns.md)
- [docs/multi-business-request/plan.md](docs/multi-business-request/plan.md)

Tasks:
1. Audit DataLoader/provider caches for scope-safe keys and operation boundaries.
2. Add or update cache isolation integration tests for multi-business requests.
3. Run final server verification matrix: lint, integration tests, and manual two-business GraphQL scenario.
4. Update the plan document with implementation status and any residual risk notes.

Validation:
All automated checks pass, manual scenario passes, and no orphaned migration code remains.
```
