---
'@accounter/client': patch
'@accounter/server': patch
---

- Introduced a new `ClientIntegrations` GraphQL type with a JSONB-backed structure
- Migrated `green_invoice_id` and `hive_id` columns to a unified `integrations` JSONB field
- Added validation helper using Zod schema for client integrations
- Updated GraphQL resolvers to use the new structure, with `GreenInvoiceClient` now resolving as a
  string ID
- Activate integrations section in the client management UI to reflect backend changes
