---
'@accounter/client': patch
'@accounter/server': patch
---

- **GraphQL Schema & Resolver Update**: The GraphQL schema for `GreenInvoiceClient` now includes a
  `businessId` field, and a corresponding resolver has been implemented on the server to fetch this
  ID from the internal client service.
- **Frontend Data & Type Alignment**: Client-side GraphQL fragments and TypeScript type definitions
  have been updated to consistently include and handle the new `businessId` field for client
  objects.
- **Business Link Correction**: The `IssueDocumentsTable` component has been modified to correctly
  utilize the `businessId` when constructing links to business detail pages, resolving the issue of
  incorrect navigation.
