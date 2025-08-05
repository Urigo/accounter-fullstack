---
'@accounter/green-invoice-graphql': minor
'@accounter/client': patch
'@accounter/server': patch
---

* **New UI for Document Generation**: A comprehensive new UI screen (`IssueDocumentScreen`) has been added, allowing users to create and configure various accounting documents (e.g., invoices, receipts) with detailed settings for document type, language, currency, and VAT.
* **Real-time Document Preview**: Users can now preview generated documents (likely PDFs) directly within the UI before officially issuing them, powered by the `pdfjs-dist` library for client-side rendering.
* **Detailed Document Configuration**: The new UI provides extensive fields for capturing client information, managing multiple income items (description, price, quantity, VAT), and specifying various payment methods with their unique details (e.g., bank, credit card, PayPal, payment app).
* **GraphQL API Extension for Preview**: The backend GraphQL API has been extended with a new `previewGreenInvoiceDocument` mutation, enabling the client to send detailed document input and receive a base64-encoded PDF preview.
* **Improved Green Invoice Integration**: New helper functions and schema updates ensure proper mapping of UI inputs to the Green Invoice API's complex data structures for document generation and preview, handling various enums and nested objects.
