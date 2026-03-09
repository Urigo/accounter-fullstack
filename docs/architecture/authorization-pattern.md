# Authorization Pattern

This project uses a layered authorization approach:

1. GraphQL directives for coarse guards (`@requiresAuth`, `@requiresRole`, `@requiresAnyRole`).
2. Domain authorization providers for business rules tied to module behavior.
3. Database RLS for tenant isolation.

## Domain Provider Template

Use a domain provider that extends `AuthorizationProvider` and is operation-scoped.

- Inject `AuthContextProvider` through the base class for role and auth checks.
- Inject `TenantAwareDBClient` for tenant-safe data checks before destructive operations.
- Keep permission logic centralized in the domain provider, not in resolvers.

Example: `ChargesAuthorizationProvider`

- `canReadCharges()`: requires authentication.
- `canWriteCharge()`: allows `business_owner` and `accountant`.
- `canDeleteCharge(chargeId)`: allows only `business_owner` and verifies charge existence.

## Resolver/Provider Integration Rules

- Application providers (like `ChargesProvider`) should call domain auth methods before write or
  delete operations.
- Resolvers should delegate authorization to providers and avoid inline role checks.
- Keep `FORBIDDEN` and `NOT_FOUND` error semantics explicit and consistent.

## Why this pattern

- Reusable authorization logic per domain.
- Easier unit and integration testing.
- Consistent behavior across modules while preserving RLS as the final enforcement layer.
