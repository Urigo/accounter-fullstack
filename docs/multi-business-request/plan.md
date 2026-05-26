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
   reports, ledger, salaries), then propagate to remaining modules. The full module inventory that
   reaches into `adminContext.ownerId` / `defaultLocalCurrency` and must migrate (or be explicitly
   deferred) is:
   - charges (`financial-charges.resolver.ts`, `charges.resolver.ts`)
   - reports (`annual-revenue.resover.ts`, `shaam6111.resolver.ts`, `reports.resolver.ts`)
   - ledger (`ledger.resolver.ts`, `ledger.provider.ts`)
   - salaries (`salaries.resolvers.ts`)
   - financial-entities (`businesses.resolver.ts`, `businesses.provider.ts`)
   - admin-context (`admin-context.provider.ts`)
   - auth (`invitations.resolver.ts`)
   - transactions (`transactions.resolver.ts` —
     `getTransactionsByFilters({ ownerIDs: [adminContext.ownerId] })`)
   - tags (`tags.provider.ts` — `reassureOwnerIdExists` fallback in `addNewTag`)
   - contracts (`contracts.provider.ts` — DataLoader keyed by `adminBusinessIds`; cross-business
     leak risk)
   - green-invoice (`green-invoice.resolvers.ts` — `ownerId = inputOwnerId ?? adminContext.ownerId`)
   - charges-matcher / `document-business.helper.ts` (indirect admin-context use)

   Sub-rule for field-level admin-context values: any field resolver that today reads
   `adminContext.defaultLocalCurrency` (or other per-business preference) must be migrated to
   resolve that value from the row's owning business via the shared scope helper, not from the
   request's active context. Multi-business reads can return rows from businesses with different
   defaults; relying on a single request-level default silently corrupts formatting.

8. Phase 7: Provider and cache isolation audit (parallel with step 6). Audit operation scope and
   in-memory caching for tenant leakage under multi-business reads, especially broad fetch providers
   and DataLoader usage. Concrete rule: any DataLoader that can be invoked during a multi-business
   read must either be `Scope.Operation` (re-instantiated per request) or key its cache by
   `(scope, entityId)` rather than `entityId` alone. Specifically audit the loaders in
   `ledger.provider.ts` (`getLedgerRecordsByIdLoader`, `batchLedgerRecordsByChargesIds`,
   `batchLedgerRecordsByFinancialEntityIds`) and the `adminBusinessIds`-keyed loader in
   `contracts.provider.ts`. See
   [docs/architecture/provider-cache-patterns.md](../architecture/provider-cache-patterns.md).
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
- [packages/server/src/modules/ledger/providers/ledger.provider.ts](packages/server/src/modules/ledger/providers/ledger.provider.ts) -
  DataLoader cache keys do not include `owner_id`; audit and re-key under multi-business reads.
- [packages/server/src/modules/transactions/resolvers/transactions.resolver.ts](packages/server/src/modules/transactions/resolvers/transactions.resolver.ts) -
  hard-codes `ownerIDs: [adminContext.ownerId]` in `getTransactionsByFilters`.
- [packages/server/src/modules/tags/providers/tags.provider.ts](packages/server/src/modules/tags/providers/tags.provider.ts) -
  `reassureOwnerIdExists(params, adminContext.ownerId)` fallback in `addNewTag`.
- [packages/server/src/modules/contracts/providers/contracts.provider.ts](packages/server/src/modules/contracts/providers/contracts.provider.ts) -
  DataLoader keyed on `adminBusinessIds`; must re-key for multi-business safety.
- [packages/server/src/modules/green-invoice/resolvers/green-invoice.resolvers.ts](packages/server/src/modules/green-invoice/resolvers/green-invoice.resolvers.ts) -
  `ownerId = inputOwnerId ?? adminContext.ownerId` fallback.
- [packages/migrations](packages/migrations) - add migration(s) for multi-business RLS helper
  function/policy updates. Concrete shape: keep `app.current_business_id` as the write-target
  session variable (set per-mutation transaction, used by `WITH CHECK`) and add
  `app.current_business_scope` (UUID array, used by `USING` on reads); helper
  `get_current_business_scope()` returns the array, `get_current_business_id()` stays unchanged.
- [docs/user-authentication-plan/spec.md](docs/user-authentication-plan/spec.md) - source
  requirements for active business context and business switch behavior.
- [docs/architecture/provider-cache-patterns.md](docs/architecture/provider-cache-patterns.md) -
  cache isolation constraints for multi-tenant safety.

**Verification**

1. Add and run focused auth-context tests covering: user with multiple memberships, default read
   scope = all memberships, invalid requested scope rejection, and write-target validation.
   Explicitly exercise all three auth paths in `auth-context.provider.ts` (JWT ~line 328, API key
   ~line 200, dev bypass ~line 31) — each currently returns a single membership via `LIMIT 1` and
   must return the full membership set.
2. Add and run TenantAwareDBClient tests covering: session variable propagation for the new
   `app.current_business_scope` array, nested transaction behavior (inner-tx rollback must restore
   outer-tx scope, not clear it), single-write-target enforcement via `app.current_business_id`, and
   isolation across pooled connections.
3. Add a new integration test `packages/server/src/__tests__/rls-multi-business.integration.test.ts`
   that opens two connections with different scope arrays and asserts the read policies show the
   expected union while write policies reject out-of-target inserts. (Replaces Prompt 07's hedge
   wording.)
4. Add integration tests for read/write semantics: multi-business query aggregation, scoped
   narrowing via header, write mutation fails without explicit business, write mutation fails for
   out-of-scope business.
5. Run focused integration tests for cache isolation with multi-business scenarios in
   [packages/server/src/**tests**/cache-isolation.integration.test.ts](packages/server/src/__tests__/cache-isolation.integration.test.ts).
6. Confirm `bootstrap-client.integration.test.ts` still passes after the Step 9 contract cut; update
   it if it asserts on the removed `adminBusinessId` field.
7. Before running any integration test, ensure migrations are applied:
   `yarn workspace @accounter/migrations migration:run`.
8. Run repository gates from root: `yarn lint`, `yarn test:integration`.
9. Manual GraphQL validation in dev: same user reads data from businesses A+B in one request, then
   write to A succeeds and write to B fails when targeting rules are not met.

**Decisions**

- Scope for this phase: server foundations first.
- Read behavior: default to all accessible businesses when no explicit scope is provided.
- Write behavior: always single-business target.
- Scope encoding: both header and GraphQL args.
- Read scope header name: `X-Business-Scope`, comma-separated UUIDs. Empty / absent means "all
  memberships".
- Write target transport: every write mutation takes an explicit `businessId: UUID!` argument.
  Writes never infer the target from the read scope, even when the read scope contains exactly one
  business — the contract is unambiguous on purpose.
- Precedence (read scope): GraphQL args ⊆ header ⊆ memberships. Args narrow; out-of-membership
  values are rejected at the auth layer, never silently dropped.
- API-key authentication: API keys remain pinned to their stored `business_id`. The
  `X-Business-Scope` header is ignored when authenticating with an API key, and any args scope must
  equal the pinned business or the request is rejected.
- Super-admin scope: super-admin status (per `super_admins` table) does NOT auto-expand read scope.
  Super-admins still pass through normal membership scoping; cross-tenant operations continue to go
  through explicit mutations (e.g. `bootstrapNewClient`).
- `user_context` table model: one row per `(owner_id)` (i.e. per business). The GraphQL
  `userContext` resolver returns the row matching the active read target when scope is singular, or
  null when scope spans multiple businesses (callers must narrow). Schema migration of
  `user_context` to a (user_id, business_id) composite is out of scope for this phase; this decision
  is recorded so the contract cut in Step 9 doesn't paint into a corner.
- RLS mechanism: two session variables. `app.current_business_id` (UUID, used by write policies via
  `WITH CHECK`) + `app.current_business_scope` (UUID array, used by read policies via `USING`).
  Helper `get_current_business_scope()` is added; `get_current_business_id()` stays.
- Active-business persistence strategy: client-side persistence.
- Compatibility strategy: hard cut (no temporary adminBusinessId compatibility layer).

**Further Considerations**

1. Because compatibility is a hard cut, keep deployment gated until client contract updates are
   merged and validated in the same release window. Known client breakage (22+ files) is
   concentrated in:
   - `packages/client/src/providers/user-provider.tsx` (root consumer of `adminBusinessId`)
   - `packages/client/src/hooks/use-update-admin-business.ts`
   - every `*-filters.tsx` under `components/` (charges, business-ledger, salaries, reports/\*)
   - `components/business/admin/admin-business-section.tsx`, `components/layout/user-nav.tsx` A
     sibling client plan must exist and be merged before the Step 9 contract cut ships.
2. Prefer introducing a shared scope-resolution helper/provider early to avoid inconsistent
   per-module enforcement during the step-6 module rollout. Concrete shape:
   `packages/server/src/modules/auth/providers/scope.provider.ts`, exposing
   - `getReadScope(context): UUID[]` — args ∩ header ∩ memberships, defaulting to all memberships
   - `resolveWriteTarget(context, requestedBusinessId): UUID` — throws if not in memberships or
     missing
   - `getBusinessPreference(businessId, key)` — replaces field-level
     `adminContext.defaultLocalCurrency` reads
3. Prioritize charges/reports/ledger first in step 6 since they have the highest concentration of
   ownerId fallback logic and the greatest tenant-safety risk.
4. Out-of-scope packages for this phase (no admin-context coupling found, but flag for follow-up if
   behavior changes): `packages/gmail-listener`, `packages/scraper-app`, `packages/*-generator`,
   `packages/modern-poalim-scraper` and other scrapers. They do not consume `adminBusinessId`
   directly today; if they ever start calling the GraphQL server with user context, the same gate
   applies.

## Implementation Status

Steps 1–15 of the blueprint are implemented (stacked PRs onto `multi-business-request`):

- **1–5** auth foundations: baseline guardrails; membership/read-scope types; full membership
  resolution across all auth paths; `X-Business-Scope` header parser; auth-context read-scope
  resolution + validation.
- **6** `resolveReadScopePrecedence` (args ⊆ header ⊆ memberships).
- **7** RLS migration: `get_current_business_scope()` + read policies on the scope array, writes
  pinned to `get_current_business_id()`.
- **8** tenant DB client sets `app.current_business_scope`.
- **9** hard-cut `userContext` to `memberships` + `activeReadScope` (single-business preference
  fields nullable); client `user-provider` adapted.
- **10** shared `ScopeProvider` (`getReadScope`, `resolveWriteTarget`, `getBusinessPreference`,
  per-owner admin-context batched by a loader).
- **11–14a** module migrations: charges, reports, ledger, salaries, transactions, green-invoice,
  balance-report, charge-suggestions, tags — reads use the scope, writes validate explicit targets,
  and per-record currency resolves from each row's owning business.
- **15** cache-isolation audit + a `scope-guard` test enforcing zero `adminContext.ownerId` /
  `adminContext.defaultLocalCurrency` references in modules (outside `admin-context`).

### Residual risks / follow-ups

1. **Write-target args not yet exposed.** Some mutations still derive the owner from the primary
   admin context because they take no explicit `businessId` arg (e.g. `generateBalanceCharge`,
   `addTag`, `insertOrUpdateSalaryRecords`, ledger entry points). Adding required args is a schema +
   client change; tracked as a follow-up. Tenant safety is still enforced by RLS.
2. **Client multi-business UI.** The server contract is hard-cut; `user-provider` derives a single
   `adminBusinessId` from the active scope so existing single-business screens keep working. A real
   multi-business client (business switcher, scoped filters) is a separate effort and gates
   production rollout.
3. **`user_context` table** remains keyed by a single `owner_id`; `userContext` preference fields
   are null for multi-business scope. A `(user_id, business_id)` model is out of scope for this
   phase.
4. **Per-record currency fallback.** Ledger/VAT/salary rows resolve currency from the owning
   business via `getBusinessPreference`, falling back to the primary business currency when a
   business has no admin-context row.
5. **RLS under superuser.** Integration tests connect as a Postgres superuser, which bypasses RLS,
   so RLS row-filtering is verified via the policy definitions and the scope helper rather than
   cross-connection visibility. Validate enforcement against a non-superuser role before rollout.
