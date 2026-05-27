---
'@accounter/server': patch
---

- **Write-Target Logic Update**: Updated the `TenantAwareDBClient` to prioritize a single business
  ID from the `X-Business-Scope` header as the write-target, falling back to the primary tenant
  business only when necessary.
- **Enhanced Integration Testing**: Added a comprehensive integration test suite that validates RLS
  enforcement across various membership and scope combinations, ensuring data integrity during write
  operations.
- **Test Coverage Improvements**: Expanded unit tests for `TenantAwareDBClient` to cover edge cases
  where the primary business ID is absent but a single scoped business is present.
