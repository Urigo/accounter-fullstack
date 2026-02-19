---
'@accounter/server': patch
---

- **Database Schema Enforcement**: A new migration was introduced to enforce the `owner_id` column
  as `NOT NULL` across numerous tables in the `accounter_schema`, a critical step for strengthening
  tenant isolation.
- **Migration Refinements**: An existing migration for `ledger_records` was updated to temporarily
  disable and re-enable Row Level Security (RLS) on the `charges` table during the `owner_id`
  backfill process, ensuring proper data manipulation without RLS interference.
- **Data Seeding and Testing Alignment**: All relevant test factories, fixture definitions, and data
  seeding scripts were updated to explicitly include and correctly handle the `owner_id` field,
  ensuring consistency with the new non-nullable constraint.
- **Query Optimization**: Several database queries in various providers (contracts, corn-jobs,
  documents, reports, transactions) were refactored to directly access the `owner_id` from the
  primary table (e.g., `transactions.owner_id`, `documents.owner_id`) instead of relying on joins to
  the `charges` table, simplifying query logic and improving efficiency.
- **Migration Cleanup**: Initial data insertion statements were removed from older migration files
  (`refactor-tags.ts`, `add-to-context-salary-excess-expenses.ts`), indicating a cleanup or
  relocation of initial data seeding logic.
