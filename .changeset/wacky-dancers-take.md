---
'@accounter/server': patch
---

- **Database Migration for RLS**: A new migration was added to introduce a nullable `owner_id`
  column to 38 tables within the `accounter_schema`. This is explicitly noted as 'Phase 1 of 4' in
  the broader strategy to implement Row-Level Security (RLS).
- **SQL Query Adjustments**: Several existing SQL queries across various modules were updated to
  either explicitly select columns instead of using `SELECT *`, or to correctly qualify the
  `owner_id` column with its table alias to prevent ambiguity.
- **Mock Data Enhancement**: Mock data creation functions for `Transaction` and `Document` objects
  now include a default `owner_id`, ensuring consistency with the evolving database schema.
