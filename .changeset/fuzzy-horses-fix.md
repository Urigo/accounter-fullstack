---
'@accounter/server': patch
---

- **Depreciation Category Deletion**: Corrected the table name used in the
  `deleteDepreciationCategory` SQL query from `depreciation` to `depreciation_categories` to ensure
  accurate data deletion.
- **Document Filtering Logic**: Updated the `getDocumentsByExtendedFilters` query to join with the
  `charges` table instead of `extended_charges` and refined the logic for identifying 'unmatched'
  documents by using a `NOT EXISTS` subquery against the `transactions` table.
- **Tax Category Query Removal**: Removed the `getTaxCategoryByChargeIDs` SQL query, its associated
  DataLoader, and related type definitions and invalidation calls, indicating the deprecation or
  removal of this specific lookup mechanism.
