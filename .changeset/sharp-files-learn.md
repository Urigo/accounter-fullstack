---
'@accounter/client': patch
'@accounter/server': patch
---

- **Enhanced Deel Invoice Fetching**: The system now fetches up to 500 Deel invoices by implementing
  pagination, ensuring a more comprehensive retrieval of financial data.
- **Handling of Unlinked Invoices**: New logic has been introduced to automatically create charges
  and corresponding records for Deel invoices that were previously unlinked or unmatched in the
  system.
- **Refactored Invoice Processing**: The process for uploading Deel invoices and inserting their
  records into the database has been centralized into a new helper function, improving code
  modularity and error handling.
- **Improved Document Type Classification**: Refunded Deel invoices are now correctly identified and
  classified as `CreditInvoice` documents, enhancing financial reporting accuracy.
- **Metadata Adjustment for Invoices**: The `description` and `remarks` fields for uploaded Deel
  invoices have been swapped to provide more relevant information in the primary description field.
