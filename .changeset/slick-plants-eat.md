---
'@accounter/client': patch
'@accounter/server': patch
---

* **Component Renaming**: I've renamed the `IssueDocumentModal` to `PreviewDocumentModal` across the client-side components to better reflect its primary function of preparing and reviewing documents before final issuance.
* **Enhanced Document Closure**: The `CloseDocumentButton` now includes enhanced functionality, allowing users to optionally issue a credit invoice when closing certain types of documents, complete with a confirmation modal for a smoother workflow.
* **Improved Document Generation Form**: I've refined the `GenerateDocument` form by implementing conditional rendering for fields like `maxPayments` and `dueDate`, and for the `IncomeForm` and `PaymentForm`, ensuring only relevant fields are displayed based on the document type. Additionally, `linkedDocumentIds` are now passed to `RecentClientDocs` for better context.
* **Refactored Document Tables**: The `RecentClientDocs` component has been refactored to leverage `@tanstack/react-table`, providing a more robust and flexible table display. It now also highlights linked documents, making it easier to identify related entries.
* **New Document Description Column**: I've introduced a new `Description` column to document tables, which displays a summary of income descriptions from the associated documents, offering more immediate insight into document content.
* **Backend Document Synchronization and Closure Improvements**: On the backend, I've updated the document synchronization logic to first process new document insertions and then handle updates to existing documents. The process for closing linked documents has also been improved to use `updateIssuedDocumentByExternalId` and now correctly avoids closing receipts.
* **GraphQL API Enhancement**: A new `originalDocument` field has been added to the `IssuedDocumentInfo` GraphQL type, enabling the retrieval of full Green Invoice document details directly from the API.
