---
'@accounter/server': patch
---

- **New Tenant-Aware Database Client**: Introduced a `TenantAwareDBClient` class, which is
  request-scoped and designed to manage database connections and operations for individual GraphQL
  requests, ensuring tenant isolation and secure data access.
- **Row-Level Security (RLS) Enforcement**: The new client automatically sets PostgreSQL session
  variables (`app.current_business_id`, `app.current_user_id`, `app.auth_type`) based on the
  authenticated user's context, enabling robust Row-Level Security policies.
- **Advanced Transaction Management**: Implemented comprehensive transaction handling, including
  support for nested transactions using `SAVEPOINT`s, automatic transaction initiation for single
  queries, and proper rollback mechanisms on errors for both top-level and nested transactions.
- **Resource Lifecycle Management**: The `TenantAwareDBClient` integrates with GraphQL Modules'
  lifecycle, automatically disposing of database connections and rolling back any active
  transactions when the operation scope ends, preventing resource leaks.
- **AuthContext Integration**: A new `AuthContext` interface and an `AUTH_CONTEXT` injection token
  were added to provide a standardized way to inject authentication and tenant information into
  services, which the `TenantAwareDBClient` utilizes.
