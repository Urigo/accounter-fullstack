---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Extension**: A new migration has been added to the database to include
  'description' and 'remarks' columns in the 'documents' table, allowing for more detailed document
  information storage.
- **Frontend UI Updates**: The user interface has been enhanced to display 'description' and
  'remarks' in the recent business documents table and within document editing forms, providing
  users with the ability to view and modify these new fields.
- **GraphQL API Integration**: The GraphQL schema, resolvers, and providers have been updated to
  support the new 'description' and 'remarks' fields across various document types and input
  operations (insert, update), ensuring API compatibility.
- **OCR and External Service Enhancements**: The OCR processing (Anthropic) and external
  integrations (Gmail, Deel) have been modified to extract, capture, and store 'description' and
  'remarks' automatically when new documents are processed or uploaded.
