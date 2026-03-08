---
'@accounter/client': patch
'@accounter/server': patch
---

- **Backend Authentication Refactoring**: Transitioned the backend's dependency injection pattern
  from `AUTH_CONTEXT` injection tokens to direct provider injection for `AuthContextProvider` and
  `AdminContextProvider` to handle asynchronous context loading more effectively.
- **Frontend Auth0 Integration**: Implemented Auth0 login on the client-side, including a new
  dedicated callback page and modifications to the existing login page to support a dual
  authentication mechanism during the transition period.
- **Enhanced Row-Level Security (RLS) Enforcement**: Modified the `TenantAwareDBClient` to
  exclusively rely on the `AuthContextProvider` for RLS variables, removing temporary fallbacks to
  legacy user context.
