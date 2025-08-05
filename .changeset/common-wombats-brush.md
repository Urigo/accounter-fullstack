---
'@accounter/green-invoice-graphql': patch
'@accounter/client': patch
'@accounter/server': patch
---

- **New Document Generation UI**: I've introduced a brand new UI screen, `IssueDocumentScreen`, that
  allows users to create and configure various accounting documents like invoices and receipts with
  extensive settings for document type, language, currency, and VAT.
- **Real-time PDF Document Preview**: Users can now preview generated documents in real-time
  directly within the UI before issuing them, powered by the `pdfjs-dist` library for client-side
  PDF rendering.
- **Comprehensive Document Configuration**: The new UI provides detailed configuration options,
  including fields for client information, managing multiple income items (description, price,
  quantity, VAT), and specifying various payment methods with their unique details (e.g., bank,
  credit card, PayPal, payment app).
- **GraphQL API Extensions for Document Management**: I've extended the GraphQL API with a new
  `previewGreenInvoiceDocument` mutation for generating PDF previews and a `newDocumentInfoDraft`
  query to pre-populate document forms based on existing charge data.
- **Enhanced Document Actions in Table View**: I've added the ability to close and re-issue
  documents directly from the documents table, providing a more streamlined workflow for managing
  document statuses.
- **New 'With Open Documents' Filter**: A new filter, 'With Open Documents', has been added to the
  charges filter, allowing users to easily identify and manage charges that have associated open
  documents.
- **GraphQL Query Refactoring**: I've refactored several GraphQL queries from fetching multiple
  charges (`chargesByIDs`) to fetching a single charge (`charge`), simplifying data retrieval for
  individual charge details.
- **Database Migration for Open Documents Flag**: A new database migration introduces an
  `open_docs_flag` to the `extended_charges` view, enabling efficient filtering of charges based on
  their associated open documents.
