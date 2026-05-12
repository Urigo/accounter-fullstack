# Super-Admin Cross-Tenant Access Plan

## 1. Objective

Enable a **super-admin** user to:

1. View all system clients (owner businesses) across tenants.
2. Operate safely in a tenant-aware backend that currently assumes one active business context per
   request.
3. Preserve strict Row-Level Security (RLS) for regular business operations.

This plan is implementation-ready and aligned with the current codebase architecture.

## 2. Current State Summary

### 2.1 What Already Exists

- Tenant-aware request DB access via `TenantAwareDBClient` with per-request RLS context
  (`app.current_business_id`, `app.current_user_id`, `app.auth_type`).
- Auth0 JWT verification and local mapping through `AuthContextProvider`.
- `super_admins` table migration exists.
- `SuperAdminProvider` exists and is already used for onboarding guardrails.

### 2.2 Current Limitation

Authentication and tenant resolution are currently coupled to selecting a single `business_users`
mapping (`LIMIT 1`).

Consequence:

- A true platform super-admin (not tied to one tenant) cannot reliably authenticate into a global
  context.
- Even with super-admin check logic, reads through tenant-scoped DB access remain restricted to one
  business.

## 3. Goals and Non-Goals

### 3.1 Goals

- Introduce a global super-admin context that is independent of tenant membership.
- Add read-only global API to list system clients.
- Add controlled tenant-switch flow for per-tenant deep inspection while preserving RLS.
- Keep existing owner/accountant/employee/api-key flows unchanged.

### 3.2 Non-Goals (Phase 1)

- Full cross-tenant write capabilities.
- Bulk cross-tenant mutation APIs.
- UI implementation details (backend contract only in this document).

## 4. Requirements

### 4.1 Functional Requirements

1. Super-admin identity is determined by `accounter_schema.super_admins.auth0_user_id`.
2. Super-admin can fetch a global list of clients (businesses_admin + business metadata).
3. Super-admin can choose a target business and execute existing tenant-scoped operations against
   that tenant.
4. Existing `bootstrapNewClient` super-admin guard remains valid.
5. Non-super-admin users must not access global APIs.

### 4.2 Security Requirements

1. RLS remains enforced for all tenant-scoped data operations.
2. Global reads must use explicitly approved system-level provider paths (no accidental broad
   bypass).
3. Super-admin APIs must require explicit authorization checks (`requireSuperAdmin`).
4. All super-admin global and tenant-switch operations are audit logged.
5. Unauthorized/forbidden responses use stable GraphQL error codes.

### 4.3 Reliability/Operational Requirements

1. No downtime migration.
2. Backward-compatible API behavior for existing clients.
3. Feature flag support for staged rollout.

## 5. Architecture Decisions

### 5.1 Auth Context Strategy

Adopt dual-mode auth context:

- **Tenant mode**: current behavior (mapped via `business_users` and `tenant.businessId`).
- **Super-admin global mode**: authenticated user exists in `super_admins`, no default tenant
  required.

Design rationale:

- Avoid forcing platform admin users into arbitrary business membership.
- Keep regular user path untouched.

### 5.2 Data Access Boundary

- **Tenant-scoped data**: must continue using `TenantAwareDBClient`.
- **Global system directory data** (list clients, super-admin checks, switch validation): use
  dedicated system-level provider backed by `DBProvider`.

Design rationale:

- Prevent weakening RLS universally.
- Make bypass explicit, auditable, and minimal.

### 5.3 Tenant Switch Model

Use explicit, request-scoped tenant override for super-admin operations:

- Client provides `targetBusinessId` for operations requiring tenant-scoped data.
- Server validates caller is super-admin and target business exists.
- Request-scoped auth context resolves `tenant.businessId = targetBusinessId`.

Design rationale:

- Preserves existing service/provider logic that expects one active tenant.
- No need to redesign all providers for multi-tenant arrays.

## 6. Data Model and Handling

### 6.1 Existing Tables Used

- `accounter_schema.super_admins`
  - Source of truth for super-admin identities (`auth0_user_id`).
- `accounter_schema.businesses_admin`
  - Canonical list of owner businesses (clients).
- `accounter_schema.financial_entities` and related business metadata tables
  - Used to enrich client listing response.

### 6.2 Optional Enhancements (Recommended)

Add columns to `super_admins` (migration in later iteration):

- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `created_by_auth0_user_id TEXT NULL`
- `revoked_at TIMESTAMPTZ NULL`

Purpose:

- Safer lifecycle management and revocation without deletion.

### 6.3 Query Patterns

Global list query should:

1. Use dedicated system provider query.
2. Join only required tables.
3. Support pagination (`limit`, `offset` or cursor).
4. Support optional search (name, owner id).
5. Sort deterministically (`created_at DESC`, then `id`).

Tenant-switch validation query should:

1. Confirm `targetBusinessId` exists in `businesses_admin`.
2. Fail with not-found error if absent.

## 7. API and Module Changes

### 7.1 New/Updated Providers

1. **Keep** `SuperAdminProvider` for authorization checks.
2. **Add** `SuperAdminDirectoryProvider` (new, operation scoped):
   - Depends on `DBProvider` (system-level reads only).
   - Methods:
     - `listSystemClients(args)`
     - `requireExistingBusiness(targetBusinessId)`
3. **Optional** `SuperAdminAuditProvider` (or integrate with existing audit provider if available):
   - Writes audit events for global list and tenant switch.

### 7.2 AuthContextProvider Changes

Update JWT resolution flow:

1. Verify JWT as today.
2. Attempt `mapAuth0UserToLocal` as today.
3. If no local mapping, check `super_admins`.
4. If super-admin:
   - Return authenticated context with `user.auth0UserId`.
   - Mark context as super-admin capable.
   - Tenant remains unset until explicit target is provided.

Implementation detail:

- Introduce optional `tenantOverrideBusinessId` from request context for super-admin requests.
- If present and valid, set `tenant.businessId` to override value.

### 7.3 GraphQL Schema Additions

Create new admin-only query surface, e.g.:

- `systemClients(input: SystemClientsInput!): SystemClientsConnection!`
- `superAdminSelectTenant(input: SuperAdminSelectTenantInput!): SuperAdminTenantSelection!`

Example contracts:

- `SystemClientsInput { limit, offset, search }`
- `SystemClientNode { businessId, businessName, ownerId, createdAt }`
- `SuperAdminSelectTenantInput { targetBusinessId }`

Notes:

- `superAdminSelectTenant` may return a signed short-lived selection token or just acknowledgment
  depending on frontend flow.
- If tokenized approach is selected, token must be signed and include actor auth0 id + target
  business id + expiry.

### 7.4 Resolver Guarding

All new global queries/mutations must begin with:

1. `requireSuperAdmin()` authorization.
2. Input validation.
3. Provider call.
4. Audit log write.

## 8. Error Handling Strategy

### 8.1 Error Codes

Use stable GraphQL extension codes:

- `UNAUTHENTICATED`: Missing/invalid token.
- `FORBIDDEN`: Authenticated but not super-admin.
- `BAD_USER_INPUT`: Invalid pagination/search/targetBusinessId format.
- `NOT_FOUND`: Target business does not exist.
- `INTERNAL_SERVER_ERROR`: Unexpected failures.

### 8.2 Failure Modes and Handling

1. **JWT valid but no business mapping and not super-admin**:
   - Return unauthenticated context for tenant operations.
2. **Super-admin global query via tenant client path**:
   - Block by design; require dedicated global provider.
3. **Tenant override requested by non-super-admin**:
   - Reject with `FORBIDDEN` and audit warning.
4. **Target business deleted between selection and request**:
   - Return `NOT_FOUND`; no fallback to previous tenant.
5. **Audit logging failure**:
   - Prefer fail-open for read-only listing, but emit structured error logs.
   - For privileged mutations, prefer fail-closed (if introduced later).

### 8.3 Observability

Emit structured logs for:

- Super-admin auth success/failure.
- Global list access.
- Tenant-switch attempts and outcomes.

Minimum log fields:

- `action`, `auth0UserId`, `targetBusinessId` (if any), `requestId`, `result`.

## 9. Security Considerations

1. Never expose full cross-tenant business internals via global list; return curated metadata only.
2. Enforce pagination limits with hard max (example: 100).
3. Ensure no direct resolver access to `DBProvider` outside approved providers.
4. Validate and sanitize search inputs to avoid inefficient wildcard scans.
5. Rate-limit global listing endpoints if necessary.

## 10. Rollout Plan

### Phase A: Foundations

1. Update `AuthContextProvider` to support super-admin global mode.
2. Add dedicated global directory provider.
3. Add unit tests for auth fallback behavior.

### Phase B: API Exposure

1. Add GraphQL schema/resolvers for `systemClients`.
2. Add resolver-level guard + audit logging.
3. Add integration tests.

### Phase C: Tenant Selection

1. Add `superAdminSelectTenant` flow.
2. Wire tenant override into request context.
3. Add integration/e2e tests for switched-tenant access.

### Phase D: Harden and Launch

1. Enable feature flag in staging.
2. Run migration/regression suites.
3. Monitor logs and error rates.
4. Enable in production.

## 11. Testing Plan

### 11.1 Unit Tests

1. `SuperAdminProvider`
   - `isSuperAdmin` returns true/false correctly.
   - `requireSuperAdmin` throws `UNAUTHENTICATED` without auth.
   - `requireSuperAdmin` throws `FORBIDDEN` for non-super-admin.
2. `AuthContextProvider`
   - Falls back to super-admin when no business mapping exists.
   - Rejects tenant override for non-super-admin.
   - Accepts tenant override for super-admin with valid business.
3. `SuperAdminDirectoryProvider`
   - Paginates/sorts/filters correctly.
   - Enforces max page size.

### 11.2 Integration Tests (GraphQL)

1. Super-admin calls `systemClients` and receives multi-tenant results.
2. Non-super-admin calls `systemClients` and gets `FORBIDDEN`.
3. Super-admin selects tenant and can query tenant-scoped data through existing resolvers.
4. Super-admin selecting nonexistent tenant returns `NOT_FOUND`.
5. Existing business_owner flow remains unchanged.

### 11.3 Security/Regression Tests

1. Verify RLS still blocks cross-tenant reads for non-super-admin users.
2. Verify global provider does not expose sensitive columns.
3. Verify audit log entries are created for privileged actions.
4. Verify no resolver imports `pg` directly and no unauthorized `DBProvider` injection.

### 11.4 Performance Tests

1. Measure `systemClients` p95 latency at expected dataset sizes.
2. Validate index coverage for sort/filter fields.
3. Load test pagination endpoint with concurrent requests.

## 12. Suggested File-Level Implementation Map

Potential target files (exact names may vary by module boundaries):

- `packages/server/src/modules/auth/providers/auth-context.provider.ts`
  - Add super-admin fallback and tenant override handling.
- `packages/server/src/modules/auth/providers/super-admin.provider.ts`
  - Keep role check logic; avoid adding heavy global list queries here.
- `packages/server/src/modules/super-admin/providers/super-admin-directory.provider.ts` (new)
- `packages/server/src/modules/super-admin/resolvers/super-admin.resolver.ts` (new)
- `packages/server/src/modules/super-admin/typeDefs/super-admin.graphql.ts` (new)
- `packages/server/src/modules/super-admin/index.ts` (new)
- App module registration file(s)
  - Register new module.
- Test files under `packages/server/src/modules/**/__tests__/`

## 13. Acceptance Criteria

1. Super-admin can list all clients through a dedicated GraphQL endpoint.
2. Non-super-admin cannot access global client listing.
3. Super-admin can explicitly select a tenant and then use existing tenant-scoped operations.
4. RLS behavior for non-super-admin users remains unchanged.
5. All new functionality is covered by unit + integration tests.
6. Audit logs are produced for all privileged super-admin operations.

## 14. Open Decisions (Must Be Finalized Before Build)

1. Tenant-switch transport model:
   - Context header per request vs short-lived signed selection token.
2. Super-admin lifecycle governance:
   - Manual DB management vs admin mutation endpoints for grant/revoke.
3. Global list payload shape:
   - Minimum metadata required by frontend without overexposing internals.

## 15. Implementation Notes for Developer Handoff

1. Start with auth-context fallback + tests before adding GraphQL API.
2. Keep global reads in isolated provider(s); do not spread `DBProvider` usage.
3. Introduce feature flag (`ENABLE_SUPER_ADMIN_GLOBAL_ACCESS`) for safe rollout.
4. Run at least:
   - `yarn lint`
   - `yarn test`
   - Relevant integration test command for server/auth modules.

This plan is designed so implementation can begin immediately with Phase A while keeping production
risk low and preserving tenant isolation guarantees.
