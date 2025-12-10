---
'@accounter/server': patch
---

- **Centralized Test Database Management**: Integration tests now leverage a `TestDatabase` utility
  class, centralizing database connection, pooling, and transaction management for improved
  consistency and isolation.
- **Transactional Test Isolation**: Individual test cases are now wrapped in `db.withTransaction`
  blocks, ensuring that each test runs within its own transaction and automatically rolls back
  changes, preventing data leakage between tests.
- **Simplified Test Setup/Teardown**: The `beforeAll`, `afterAll`, `beforeEach`, and `afterEach`
  hooks in several test files have been streamlined, removing manual `pg.Pool` and `pg.PoolClient`
  management in favor of the `TestDatabase` class's methods.
- **Removed Obsolete Function**: The `resetSetupFlags` function, previously a no-op, has been
  removed from `db-setup.ts`.
- **Import Path Correction**: A minor import path correction for `DBProvider` was made in
  `business-trips.provider.ts`.
