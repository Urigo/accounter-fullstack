---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Contracts Screen**: A dedicated user interface has been introduced for viewing and managing
  client contracts, accessible via a new sidebar link.
- **Enhanced Contract Management**: The new screen features a comprehensive data table for
  contracts, offering functionalities like sorting, filtering by various criteria (product type,
  billing cycle, subscription plan, active status), column visibility toggling, and pagination.
- **Contract Editing Functionality**: Users can now edit existing contracts directly from the
  contracts table through a modified dialog that fetches and pre-fills contract details for a
  seamless editing experience.
- **Bulk Document Issuance**: A new modal allows users to select multiple contracts and generate
  document drafts for a specified month, streamlining the process of creating invoices or other
  contract-related documents.
- **Backend API and Caching Improvements**: New GraphQL queries and resolvers have been added to
  support fetching contracts by administrator ID and individual contract details. The backend also
  includes refined cache invalidation logic for contract operations, ensuring data consistency and
  improved performance.
