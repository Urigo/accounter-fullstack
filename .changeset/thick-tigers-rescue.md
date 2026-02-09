---
'@accounter/server': patch
---

- **TenantAwareDBClient Registration**: The `TenantAwareDBClient` is now registered as an
  operation-scoped provider in GraphQL Modules, enabling dependency injection for RLS enforcement.
- **ESLint Rule for DBProvider**: Added an ESLint rule to prevent direct imports of `DBProvider` in
  resolver and service files, encouraging the use of `TenantAwareDBClient`.
