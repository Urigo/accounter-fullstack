---
'@accounter/server': patch
---

- **Database Schema Update**: Added 'date_established' and 'initial_accounter_year' columns to the
  'user_context' table via a new migration.
- **API and Type Updates**: Updated GraphQL type definitions, resolvers, and internal TypeScript
  types to include the new business context fields.
- **Testing**: Updated integration tests and context builders to support and verify the new business
  date fields.
