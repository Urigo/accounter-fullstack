---
'@accounter/server': patch
---

- **Client Integration**: Added a new public method, `getDocumentLinks`, within the
  `GreenInvoiceClientProvider` to abstract the fetching of document download links using the new
  GraphQL query.
- **Document URL Retrieval Logic**: Updated the `insertNewDocumentFromGreenInvoice` helper function
  to utilize the new `getDocumentLinks` method for retrieving document file URLs, prioritizing
  English language links and including error handling for cases where no links are found.
