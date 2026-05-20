## Plan: Multi-Business Request Scope Foundations

Shift the server from a single active business model to a request-level business scope model: reads
default to all businesses the user can access, writes require exactly one explicit target business,
and scope can be controlled via both header and GraphQL args. This keeps tenant isolation in RLS
while enabling multi-business reads per request. The phase is server foundations only, with a hard
contract cut and no temporary legacy field compatibility.

**Steps**

1. Phase 0: Baseline and safety gates. Capture current auth-context, RLS, and userContext behavior
   in focused tests before refactor so regressions are visible early. Define rollout gate that
   prevents production deploy until matching client changes are ready because compatibility mode is
   intentionally excluded.
2. Phase 1: Redesign auth and request scope context (depends on step 1). Extend auth context from
   single tenant business to memberships plus validated read scope. Remove single-row assumptions in
   membership lookup (current LIMIT 1 behavior) and resolve all business memberships for the
   authenticated user. Parse and validate request scope header as a subset of memberships.
3. Phase 2: Add multi-business RLS session context (depends on step 2). Introduce database session
   variable and helper function for business-id arrays, update policies to allow owner_id in active
   scope, and keep strict write semantics through a single explicit write target business.
4. Phase 3: Update TenantAwareDBClient contract (depends on step 3). Set both read scope and write
   target session context per operation, enforce unauthenticated and invalid-scope failure paths,
   and expose clear read/write usage paths for providers.
5. Phase 4: Hard-cut GraphQL user context contract (depends on step 2). Replace single
   adminBusinessId response shape with multi-business-aware fields (memberships and active read
   scope data) and update resolver composition accordingly.
6. Phase 5: Refactor write paths to explicit single-business targeting (depends on step 4). Remove
   fallback-to-admin-context ownerId patterns in mutations/providers and require explicit target
   business through args (or derived strict write context), with authorization checks against
   membership and role.
7. Phase 6: Refactor read paths to scoped multi-business defaults (depends on step 4, parallel by
   module group). Apply a shared scope resolver rule: explicit args intersect with authorized scope,
   otherwise default to all accessible businesses. Prioritize high-traffic modules first (charges,
   reports, ledger, salaries), then propagate to remaining modules.
8. Phase 7: Provider and cache isolation audit (parallel with step 6). Audit operation scope and
   in-memory caching for tenant leakage under multi-business reads, especially broad fetch providers
   and DataLoader usage.
9. Phase 8: Verification and rollout readiness (depends on steps 5-8). Execute focused
   auth/RLS/integration suites, then full integration/lint gates, plus manual GraphQL scenario
   validation for multi-business reads and single-business writes.

**Relevant files**

- [packages/server/src/shared/types/auth.ts](packages/server/src/shared/types/auth.ts) - current
  single tenant context type that must become membership + scope aware.
- [packages/server/src/plugins/auth-plugin.ts](packages/server/src/plugins/auth-plugin.ts) - parse
  business-scope header and attach raw scope input.
- [packages/server/src/modules/auth/providers/auth-context.provider.ts](packages/server/src/modules/auth/providers/auth-context.provider.ts) -
  remove single-membership mapping, resolve all memberships, validate requested scope.
- [packages/server/src/modules/auth/providers/business-users.provider.ts](packages/server/src/modules/auth/providers/business-users.provider.ts) -
  source of membership retrieval helpers and potential expansion for scoped lookups.
- [packages/server/src/modules/app-providers/tenant-db-client.ts](packages/server/src/modules/app-providers/tenant-db-client.ts) -
  set/read request business-scope session variables and enforce write target semantics.
- [packages/server/src/modules/admin-context/providers/admin-context.provider.ts](packages/server/src/modules/admin-context/providers/admin-context.provider.ts) -
  remove implicit single-business defaults and adapt downstream consumers.
- [packages/server/src/modules/common/typeDefs/user-context.graphql.ts](packages/server/src/modules/common/typeDefs/user-context.graphql.ts) -
  hard-cut schema contract from adminBusinessId to multi-business fields.
- [packages/server/src/modules/common/resolvers/user-context.resolver.ts](packages/server/src/modules/common/resolvers/user-context.resolver.ts) -
  return new multi-business context payload.
- [packages/server/src/modules/financial-entities/providers/businesses.provider.ts](packages/server/src/modules/financial-entities/providers/businesses.provider.ts) -
  enforce scoped reads (current allBusinesses path is broad) and audit cache behavior.
- [packages/server/src/modules/financial-entities/resolvers/businesses.resolver.ts](packages/server/src/modules/financial-entities/resolvers/businesses.resolver.ts) -
  apply scoped read/write business rules in resolvers.
- [packages/server/src/modules/auth/resolvers/invitations.resolver.ts](packages/server/src/modules/auth/resolvers/invitations.resolver.ts) -
  align invitation create/accept flows with explicit scope/write rules.
- [packages/server/src/modules/reports/resolvers/annual-revenue.resover.ts](packages/server/src/modules/reports/resolvers/annual-revenue.resover.ts) -
  example of current fallback-to-adminBusinessId logic to convert to scoped behavior.
- [packages/server/src/modules/reports/resolvers/shaam6111.resolver.ts](packages/server/src/modules/reports/resolvers/shaam6111.resolver.ts) -
  explicit businessId override path to align with new scope semantics.
- [packages/server/src/modules/charges/resolvers/financial-charges.resolver.ts](packages/server/src/modules/charges/resolvers/financial-charges.resolver.ts) -
  high-impact ownerId fallback patterns requiring explicit write/read scope rules.
- [packages/server/src/modules/salaries/resolvers/salaries.resolvers.ts](packages/server/src/modules/salaries/resolvers/salaries.resolvers.ts) -
  heavy use of verified admin context ownerId; requires explicit targeting updates.
- [packages/server/src/modules/ledger/resolvers/ledger.resolver.ts](packages/server/src/modules/ledger/resolvers/ledger.resolver.ts) -
  broad ownerId assumptions and generation flows to migrate.
- [packages/migrations](packages/migrations) - add migration(s) for multi-business RLS helper
  function/policy updates.
- [docs/user-authentication-plan/spec.md](docs/user-authentication-plan/spec.md) - source
  requirements for active business context and business switch behavior.
- [docs/architecture/provider-cache-patterns.md](docs/architecture/provider-cache-patterns.md) -
  cache isolation constraints for multi-tenant safety.

**Verification**

1. Add and run focused auth-context tests covering: user with multiple memberships, default read
   scope = all memberships, invalid requested scope rejection, and write-target validation.
2. Add and run TenantAwareDBClient tests covering: session variable propagation for business-id
   arrays, nested transaction behavior, and single-write-target enforcement.
3. Add integration tests for read/write semantics: multi-business query aggregation, scoped
   narrowing via header, write mutation fails without explicit business, write mutation fails for
   out-of-scope business.
4. Run focused integration tests for cache isolation with multi-business scenarios in
   [packages/server/src/**tests**/cache-isolation.integration.test.ts](packages/server/src/__tests__/cache-isolation.integration.test.ts).
5. Run repository gates from root: yarn lint, yarn test:integration.
6. Manual GraphQL validation in dev: same user reads data from businesses A+B in one request, then
   write to A succeeds and write to B fails when targeting rules are not met.

**Decisions**

- Scope for this phase: server foundations first.
- Read behavior: default to all accessible businesses when no explicit scope is provided.
- Write behavior: always single-business target.
- Scope encoding: both header and GraphQL args.
- Active-business persistence strategy: client-side persistence.
- Compatibility strategy: hard cut (no temporary adminBusinessId compatibility layer).

**Further Considerations**

1. Because compatibility is a hard cut, keep deployment gated until client contract updates are
   merged and validated in the same release window.
2. Prefer introducing a shared scope-resolution helper/provider early to avoid inconsistent
   per-module enforcement during the step-6 module rollout.
3. Prioritize charges/reports/ledger first in step 6 since they have the highest concentration of
   ownerId fallback logic and the greatest tenant-safety risk.
