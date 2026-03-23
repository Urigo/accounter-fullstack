---
'@accounter/server': patch
---

- **Enhanced Search Performance**: Introduced the `pg_trgm` PostgreSQL extension and created GIN
  indexes on relevant text columns (`user_description`, `source_description`, `source_reference`,
  `description`, `remarks`, `serial_number`) across `charges`, `transactions`, and `documents`
  tables to significantly improve the performance of free-text search queries.
- **SQL Query Refactoring for `getChargesByFilters`**: The `getChargesByFilters` SQL query was
  extensively refactored using Common Table Expressions (CTEs) to optimize its structure and
  execution. This includes a new `search_matches` CTE that leverages the new GIN indexes for
  efficient initial filtering based on free text, and a `filtered_charges` CTE to serve as the
  primary data source for subsequent joins and aggregations.
- **SQL Query Refactoring for `getSimilarCharges`**: The `getSimilarCharges` SQL query was also
  refactored to utilize CTEs, improving its readability and maintainability by breaking down complex
  logic into smaller, more manageable parts.
