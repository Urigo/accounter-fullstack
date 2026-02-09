---
'@accounter/server': patch
---

- **Provider Cache Patterns Documentation**: Added a new document outlining provider cache patterns
  and isolation strategies to prevent data leakage in multi-tenant architectures.
- **AdminContext Provider Refactoring**: Refactored the existing `AdminContextProvider` to use
  `Scope.Operation` for request-scoped caching and proper DI integration, addressing tenant leakage
  risks. The original plugin remains active.
- **TenantAwareDBClient and AUTH_CONTEXT**: The PR prepares for a future phase (4.8) where
  `DBProvider` will be switched to `TenantAwareDBClient` and `AUTH_CONTEXT` will be integrated. The
  current refactoring keeps the existing `DBProvider` to avoid breaking changes.
- **Cache Isolation Integration Tests**: Added new integration tests to verify cache isolation
  between concurrent requests for various providers.
- **Provider Scope Changes**: Many providers are changed to `Scope.Operation` to ensure
  tenant-specific data is handled with request-level isolation.
