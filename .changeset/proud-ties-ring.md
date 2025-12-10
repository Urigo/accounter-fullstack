---
'@accounter/server': patch
---

- **Centralized Migration Verification Logic**: Introduced a new helper module
  `migration-verification.ts` that centralizes the logic for checking and asserting whether the
  latest database migration has been applied. This module provides both a non-throwing
  `checkLatestMigration` function and an `assertLatestMigrationApplied` function that throws an
  error if the migration is not found.
- **New CI/CD Migration Verification Script**: Added a new standalone script `verify-migrations.ts`
  that leverages the centralized verification logic. This script connects to a PostgreSQL database
  using environment variables and exits with a non-zero status if the latest migration is not
  applied, making it suitable for CI/CD pipelines.
- **Refactored Test Suite**: Updated the `db-bootstrap.test.ts` file to utilize the newly created
  `assertLatestMigrationApplied` utility, replacing the previous inline query for migration
  verification. This improves consistency and reduces code duplication in tests.
