---
'@accounter/server': patch
---

- **Enhanced PCN Report Generation for Foreign Customers**: Implemented specific logic within
  `getHeaderDataFromRecords` to correctly categorize and sum sales from
  `EntryType.SALE_UNIDENTIFIED_CUSTOMER`, ensuring proper handling of both zero-VAT and taxable
  transactions for foreign businesses.
- **Improved Transaction Classification**: Modified the `transactionsFromVatReportRecords` function
  to accurately assign `EntryType.SALE_UNIDENTIFIED_CUSTOMER` to non-expense transactions from
  foreign entities that have a VAT number but an undefined `pcn874RecordType`.
- **Refactoring and Export of Helper Functions**: Several internal helper functions
  (`getHeaderDataFromRecords`, `getEntryTypeByRecord`, `getVatIdForTransaction`,
  `getReferenceForTransaction`, `getTotalVAT`) were refactored, renamed, and exported to improve
  modularity and testability.
- **Comprehensive Test Coverage**: Added extensive unit and integration tests, including snapshot
  tests, for the PCN helper functions and the `getPcn874String` generation, specifically covering
  foreign businesses with VAT, credit invoices, imports/exports, and various other edge cases to
  ensure report accuracy.
