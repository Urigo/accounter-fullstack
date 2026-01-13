---
'@accounter/server': patch
---

- **Property VAT Category**: Introduced a new `propertyOutputVatTaxCategoryId` to specifically
  handle output VAT for property-related charges, ensuring distinct categorization in ledger entries
  and reports.
- **VAT Adjustment Rule**: Implemented a '2/3 rule' for VAT calculation on property charges,
  adjusting the VAT amount in both ledger generation and VAT report helpers.
- **Validation for Property Charges**: Added validation checks to ensure that charges marked as
  'property' have the necessary `propertyOutputVatTaxCategoryId` configured and are associated with
  depreciation records, preventing data inconsistencies.
- **Code Refactoring**: Refactored the `transformTransactions` function in `pcn.helper.ts` to
  `transactionsFormVatReportRecords` for improved clarity and semantic accuracy.
