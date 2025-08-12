---
'@accounter/modern-poalim-scraper': patch
---

- **Database Schema Extension**: A new database migration has been added to extend the
  `isracard_creditcard_transactions` and `amex_creditcard_transactions` tables. This migration
  introduces a new `esb_services_call` column of type `text` to both tables, allowing for the
  storage of additional service call information related to these transactions.
- **Schema Validation Modernization (JSON Schema to Zod)**: The data validation mechanism for
  Isracard and Amex transaction lists has been modernized by migrating from a traditional JSON
  schema to a Zod-based schema. This involved removing the old JSON schema file, adding the `zod`
  library as a dependency, and creating a new TypeScript file defining the
  `IsracardCardsTransactionsListSchema` using Zod. The `amex.ts` and `isracard.ts` scrapers were
  updated to utilize this new, type-safe validation approach.
- **Transaction Processing Updates**: The transaction processing logic in `isracard-amex-month.ts`
  has been updated to accommodate the new `esb_services_call` column. This includes modifying SQL
  insert statements to correctly store data in the new column and adjusting the attribute checking
  logic to properly handle the new field during transaction processing.
