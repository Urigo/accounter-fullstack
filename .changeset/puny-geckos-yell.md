---
'@accounter/server': patch
---

* **New GraphQL API for Document Ingestion**: A new GraphQL module (`gmail-listener`) has been introduced on the Accounter server, exposing `businessEmailConfig` (query) and `insertEmailDocuments` (mutation) operations. This API allows the dedicated Gmail listener service to fetch business-specific email processing configurations and programmatically insert extracted documents, ensuring structured and authenticated communication.
* **Introduction of 'gmail_listener' Role**: A new `gmail_listener` role has been added to the system via a database migration. This role is specifically designed for the automated Gmail listener service, granting it necessary permissions to interact with the new GraphQL API and perform document insertion operations.
* **Enhanced Document Upload Process**: The `getDocumentFromFile` helper function has been updated to support passing `counterPartyId` and a pre-calculated `hash`, improving flexibility and efficiency when uploading documents, especially from external services like the new Gmail listener.
* **Refactored Authorization for Charge Creation**: The `canWriteCharge` authorization logic has been updated to explicitly allow the new `gmail_listener` role (and the existing `scraper` role) to create charges, reflecting their automated document processing responsibilities.