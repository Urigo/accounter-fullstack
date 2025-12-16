---
'@accounter/client': patch
'@accounter/server': patch
---

- **Refactored Document Issuing Logic**: The core document issuing and drafting functionalities have
  been extracted from the `green-invoice` module and relocated to a new, dedicated
  `documents-issuing` module within the `documents` domain. This enhances modularity and improves
  the separation of concerns.
- **Standardized Document Types**: Green Invoice specific enums like `GreenInvoiceDocumentLang`,
  `GreenInvoiceVatType`, `GreenInvoiceDiscountType`, `GreenInvoicePaymentType`,
  `GreenInvoicePaymentCardType`, and `GreenInvoiceLinkType` have been replaced with more generic and
  reusable types such as `DocumentLanguage`, `DocumentVatType`, `DocumentDiscountType`,
  `PaymentType`, `DocumentPaymentRecordCardType`, and `DocumentLinkType`. This change reduces
  coupling to the Green Invoice API.
- **Standardized Country Codes**: A new `CountryCode` enum has been introduced in the client-side
  helpers, replacing the Green Invoice specific country enum. This ensures consistent country
  handling across the application.
- **Renamed Sync Functionality**: The `PullDocumentsModal` component and `useFetchIncomeDocuments`
  hook have been renamed to `SyncDocumentsModal` and `useSyncGreenInvoiceDocuments` respectively, to
  more accurately reflect their purpose of synchronizing documents with Green Invoice.
- **GraphQL Schema and Type Renames**: GraphQL types and fragments related to document drafting have
  been renamed for clarity and consistency. `NewDocumentInfo` is now `DocumentDraft`, and
  `NewDocumentInput` is `DocumentIssueInput`, with corresponding updates across queries and
  mutations.
