---
'@accounter/client': patch
'@accounter/server': patch
---

- **New GraphQL Queries and Resolvers**: Introduced new GraphQL queries (`recentDocumentsByClient`
  and `recentIssuedDocumentsByType`) and corresponding backend resolvers to efficiently fetch
  documents based on client ID and document type, respectively. This enables the new UI features.
- **Reusable Documents Table**: The `DocumentsTable` component has been refactored to be more
  generic and reusable. It now accepts a direct array of document fragments and includes a `limited`
  prop to control column visibility, making it suitable for displaying concise lists of documents in
  various contexts.
- **Backend Data Fetching Improvements**: New SQL queries and a DataLoader have been added to the
  `IssuedDocumentsProvider` to optimize the fetching of documents by client ID, ensuring efficient
  data retrieval for the new frontend features.
