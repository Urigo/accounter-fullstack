---
'@accounter/server': patch
---

- **Owner ID Enforcement**: Implemented a system-wide enforcement of `owner_id` for all new record
  insertions into various protected database tables, ensuring data ownership and multi-tenancy.
- **New Helper Function**: Introduced a new helper function, `reassureOwnerIdExists`, to standardize
  the injection of `owner_id` into database insert parameters, falling back to the default admin
  business ID if not explicitly provided.
- **SQL Query Modifications**: Modified numerous SQL `INSERT` statements across multiple modules to
  include the `owner_id` column and its corresponding value, and updated `ON CONFLICT` clauses where
  applicable.
- **Provider Integration**: Injected the GraphQL `CONTEXT` into the constructors of various data
  providers to enable access to the `owner_id` and integrated the `reassureOwnerIdExists` helper
  into their `insert` methods.
