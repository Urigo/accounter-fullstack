---
'@accounter/server': patch
---

- **Robust Initialization**: Implemented a constructor check in `DBProvider` to ensure a PostgreSQL
  pool instance is always provided, improving initialization robustness.
- **Database Health Check**: Introduced a `healthCheck` method to `DBProvider` for verifying
  database connectivity, crucial for monitoring and readiness probes.
- **Graceful Shutdown**: Added a `shutdown` method to `DBProvider` to enable graceful termination of
  the database connection pool during application shutdown.
- **Clear Usage Documentation**: Enhanced `DBProvider` with detailed JSDoc comments, clearly
  distinguishing between system-level database access (bypassing RLS) and future request-level
  access (enforcing RLS via `TenantAwareDBClient`).
- **Comprehensive Test Coverage**: Created a comprehensive test suite for `DBProvider`, covering its
  constructor, `query`, `healthCheck`, and `shutdown` methods, ensuring reliability and correctness.
