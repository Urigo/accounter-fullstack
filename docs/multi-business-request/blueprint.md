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
14. Salaries plus admin-context migration. 14a. Remaining modules migration (transactions, tags,
    contracts, green-invoice, charges-matcher).
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
3. Update the three single-business lookup sites in auth-context.provider.ts that currently use LIMIT 1: the JWT path (~line 328), the API key path (~line 200), and the dev bypass path (~line 31). Each must resolve the full membership set.
4. Note that BusinessUsersProvider already has a DataLoader (`getBusinessUsersByAuth0IdsLoader`) returning all rows per Auth0 ID — wire that in rather than adding a new query.
5. Add provider-level tests for no-membership, one-membership, multi-membership cases on each auth path.

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
1. Implement parser utility for the `X-Business-Scope` request header — a comma-separated list of business UUIDs.
2. Normalize whitespace and duplicates; preserve insertion order for deterministic logging.
3. Return typed validation errors for malformed IDs (non-UUID, empty entry after split, etc.).
4. Treat absent / empty header as "no narrowing" (i.e. default-all upstream). Distinguish empty-after-split (malformed) from absent.
5. Add unit tests for valid, empty, absent, malformed, duplicate, whitespace, and mixed input cases.

Constraints:
Do not wire parser into auth decisions yet. Header name is pinned: `X-Business-Scope`.

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
1. Replace single-membership mapping with full membership resolution in all three auth paths (JWT, API key, dev bypass).
2. Apply requested header scope as a validated subset of memberships.
3. Reject out-of-membership requested scope (do not silently drop unknown IDs).
4. For API-key auth specifically: ignore `X-Business-Scope` and pin the scope to the key's stored `business_id`. Reject the request if args scope is provided and doesn't equal the pinned business.
5. Super-admin status does NOT auto-expand scope here — same membership rules apply.
6. Add integration-style provider tests for default-all, subset validation, API-key pinning, and super-admin behavior.

Validation:
Run auth provider tests and ensure unauthorized flows still fail correctly.
```

### Prompt 06: Add Header vs Args Precedence

```text
You are implementing Step 6. Assume Steps 1-5 are merged.

Goal:
Define and test request-scope precedence across transport layers.

Precedence rule:
- Read scope: GraphQL args scope (if provided) narrows the request; otherwise use `X-Business-Scope` header; if neither exists, use all accessible businesses. Args ⊆ header ⊆ memberships at every step.
- Write target: a separate input — every write mutation takes an explicit `businessId: UUID!` argument and never infers from read scope.
- API-key auth is a third precedence input: it pins scope to one business; header is ignored and args must agree.

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
1. Add migration introducing session variable `app.current_business_scope` (UUID array) alongside the existing `app.current_business_id`.
2. Add helper `accounter_schema.get_current_business_scope()` returning `uuid[]` from `current_setting('app.current_business_scope', true)`, parsing the JSON/text-array form chosen in step 8.
3. Update read policies on all RLS-enabled tables to use `owner_id = ANY (accounter_schema.get_current_business_scope())` in `USING`.
4. Keep write policies (`WITH CHECK`) on `owner_id = accounter_schema.get_current_business_id()` so writes remain pinned to a single explicit target.
5. Do NOT remove `get_current_business_id()` — it stays as the write-target helper.
6. Add `packages/server/src/__tests__/rls-multi-business.integration.test.ts`: open two connections, set distinct scope arrays, assert each sees the expected union of rows and that out-of-target inserts are rejected.

Validation:
Run migration verification checks and the new RLS integration test. Ensure migrations are applied first via `yarn workspace @accounter/migrations migration:run`.
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
1. Set both `app.current_business_id` (single write target, when a write is in progress) and `app.current_business_scope` (UUID array, every operation) via `set_config(..., true)` inside the operation's transaction.
2. Pick a stable serialization for the array — recommend Postgres text-array literal (`'{uuid1,uuid2}'`) so `current_setting()::uuid[]` parses cleanly in the helper; pin this in code and tests.
3. Ensure values are propagated in nested transactions: an inner-tx rollback must restore the outer-tx scope, not clear it. Document and test the savepoint behavior.
4. Reject operations with no authenticated context (no scope can be set).
5. Add tests for: missing auth, invalid scope (non-UUID, non-member), valid scope propagation, nested transaction rollback behavior, pooled-connection isolation (two requests on the same pool connection don't bleed scope).

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
1. Update GraphQL schema: replace `adminBusinessId: UUID!` with `memberships: [BusinessMembership!]!` (each carrying `businessId`, `role`, display fields) and `activeReadScope: [UUID!]!` (the resolved scope for this request).
2. `userContext` body fields that today derive from a single business (e.g. tax preferences, default local currency) resolve from the row matching the active read target when scope is singular, and return null when scope is multi-business — callers must narrow. This matches the `user_context` table's current single-`owner_id` keying; no schema migration of the table here.
3. Update resolver payload accordingly; remove legacy `adminBusinessId` field with no compatibility shim.
4. Run `yarn generate` and update any server-side consumers that broke.
5. Update `bootstrap-client.integration.test.ts` if it asserts on `adminBusinessId`.
6. Add resolver/schema tests for new shape, multi-membership users, super-admin behavior, and the singular-scope vs. multi-scope `userContext` rules.

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
1. Create `packages/server/src/modules/auth/providers/scope.provider.ts` (new `@Injectable()` provider) with:
   - `getReadScope(context): UUID[]` — args ∩ header ∩ memberships, defaulting to all memberships.
   - `resolveWriteTarget(context, requestedBusinessId): UUID` — throws if missing or not a member; returns the validated UUID.
   - `getBusinessPreference(businessId, key)` — replaces per-field `adminContext.defaultLocalCurrency` reads so multi-business reads can resolve preferences per row's owning business.
2. Integrate helper into businesses resolver/provider flow as reference implementation. Remove `adminContext.ownerId` reads from this module.
3. Audit `businesses.provider.ts`'s `insertBusinessLoader` and `batchGenerateBusinessesOutOfTransactions` — they must take an explicit `businessId` arg, not derive from admin-context.
4. Add tests proving default-all, narrowed scope, out-of-scope rejection, and write-target validation.

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

### Prompt 14a: Remaining Modules Migration

```text
You are implementing Step 14a. Assume Steps 1-14 are merged.

Goal:
Migrate the remaining modules that depend on admin-context.ownerId / defaultLocalCurrency. The plan misses these in Prompts 11-14; they must reach zero before Prompt 15's cache audit, otherwise the audit will find live admin-context fallbacks.

Context files:
- [packages/server/src/modules/transactions/resolvers/transactions.resolver.ts](packages/server/src/modules/transactions/resolvers/transactions.resolver.ts)
- [packages/server/src/modules/tags/providers/tags.provider.ts](packages/server/src/modules/tags/providers/tags.provider.ts)
- [packages/server/src/modules/contracts/providers/contracts.provider.ts](packages/server/src/modules/contracts/providers/contracts.provider.ts)
- [packages/server/src/modules/green-invoice/resolvers/green-invoice.resolvers.ts](packages/server/src/modules/green-invoice/resolvers/green-invoice.resolvers.ts)
- charges-matcher helpers (e.g. `document-business.helper.ts`)

Tasks:
1. transactions: replace `ownerIDs: [adminContext.ownerId]` in `getTransactionsByFilters` with the shared scope helper's read scope.
2. tags: `addNewTag` must take an explicit `businessId` write target; remove the `reassureOwnerIdExists(params, adminContext.ownerId)` fallback.
3. contracts: re-key the DataLoader (currently keyed on `adminBusinessIds`) so cache keys include the full scope, or convert the provider to `Scope.Operation`.
4. green-invoice: remove the `ownerId = inputOwnerId ?? adminContext.ownerId` fallback; require explicit `businessId`.
5. charges-matcher / `document-business.helper.ts`: route any admin-context reads through the shared scope helper.
6. Grep one more time for `adminContext.ownerId` and `adminContext.defaultLocalCurrency` across `packages/server/src/modules/` — the result must be zero outside of `admin-context` itself and field resolvers that have moved to `getBusinessPreference`.

Validation:
Run module tests, lint, and a repository-wide grep guard test (added in Prompt 15) that fails if any module under `packages/server/src/modules/` (excluding admin-context) references `adminContext.ownerId`.
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
1. Audit DataLoader/provider caches for scope-safe keys and operation boundaries. Concrete rule: any DataLoader that can fire during a multi-business read either is `Scope.Operation` (re-instantiated per request) or includes the scope in its cache key. Specifically verify the loaders in `ledger.provider.ts` (`getLedgerRecordsByIdLoader`, `batchLedgerRecordsByChargesIds`, `batchLedgerRecordsByFinancialEntityIds`) and the loader in `contracts.provider.ts` that today keys on `adminBusinessIds`.
2. Add or update cache isolation integration tests for multi-business requests in `packages/server/src/__tests__/cache-isolation.integration.test.ts` — one request must not see another's cached rows even when entity IDs overlap.
3. Add a lint/test guard that fails if any file under `packages/server/src/modules/` (except `admin-context/`) references `adminContext.ownerId` or `adminContext.defaultLocalCurrency`.
4. Run final server verification matrix: `yarn workspace @accounter/migrations migration:run`, `yarn lint`, `yarn test:integration`, and a manual two-business GraphQL scenario (multi-business read aggregation, single-target write success, out-of-scope write rejection).
5. Update the plan document with implementation status and any residual risk notes, especially around the `user_context` table's single-`owner_id` model (still out of scope for this phase) and the client refactor's status.

Validation:
All automated checks pass, manual scenario passes, no orphaned migration code remains, and the repo-wide grep guard returns zero hits.
```
