---
'@accounter/server': patch
---

- **Refactored Charge Attributes**: The pull request removes the direct usage of 'extended_charge'
  attributes, which were denormalized fields. Instead, charge-related metadata such as total
  amounts, document counts, transaction counts, and business IDs are now dynamically computed using
  new helper functions that query associated entities (transactions, documents, ledger records) on
  demand.
- **Enhanced Data Retrieval Helpers**: New helper functions like 'calculateTotalAmount',
  'getChargeBusinesses', 'getChargeDocumentsMeta', 'getChargeLedgerMeta', 'getChargeTaxCategoryId',
  'getTransactionsMeta', and 'getLedgerMeta' have been introduced or significantly updated. These
  helpers ensure that charge metadata is always derived from the most current source data.
- **Updated Resolvers and Logic**: Numerous resolvers and helper functions across various modules
  (e.g., accountant-approval, business-trips, documents, ledger, reports) have been updated to
  utilize the new data retrieval helpers. This ensures that all parts of the application correctly
  fetch and process charge information without relying on the deprecated 'extended_charge'
  attributes.
- **Improved Caching and Type Definitions**: Caching has been added to the 'ChargesProvider' for
  better performance. Additionally, GraphQL type definitions for 'ChargeMetadata' have been
  simplified by removing redundant fields like 'invalidDocuments' and 'invalidTransactions', as
  these are now computed dynamically.
