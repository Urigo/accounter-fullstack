---
'@accounter/server': patch
---

- **Receipt Prioritization in Matching**: The definition of a "matched" charge has been updated. A
  charge is now considered matched if it contains both transactions and receipt documents. Invoices
  and credit invoices no longer contribute to a charge's matched status.
- **Document Aggregation Logic Refinement**: When aggregating documents for a charge, receipts are
  now given higher priority. If receipts are present, only receipt-type documents will be considered
  for aggregation, overriding invoices and credit invoices.
- **Unified Accounting Document Check**: The `isAccountingDocument` helper function has been
  simplified to always include `Proforma` documents, removing the need for a separate
  `includeProforma` parameter.
- **Code Cleanup**: Unused helper functions (`hasOnlyTransactions`, `hasOnlyDocuments`) and their
  corresponding tests have been removed to streamline the codebase.
