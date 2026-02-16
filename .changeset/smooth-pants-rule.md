---
'@accounter/server': patch
---

- **PostgreSQL Connection Limits**: Reduced the default maximum PostgreSQL client connections from
  100 to 20 to better manage database resources and prevent exhaustion.
- **Database Client Disposal Logic**: Improved the `TenantAwareDBClient` disposal logic to prevent
  connection leaks, handle cases where an active client is still present during disposal, and ensure
  proper cleanup in error scenarios.
- **Asynchronous Cleanup Execution**: Ensured that database client cleanup operations are properly
  awaited in the execution pipeline, specifically within the `dbCleanupPlugin`, to guarantee
  connections are released before responses are sent and prevent connection accumulation.
