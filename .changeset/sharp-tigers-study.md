---
'@accounter/server': patch
---

- **Intent**: This pull request aims to prevent the creation of duplicate document entries by
  introducing a file hashing mechanism. It adds a `file_hash` column to the `documents` table and
  integrates file hash generation and storage into the document upload process.
- **Key Changes**: A new database migration adds a `file_hash` column to the
  `accounter_schema.documents` table. File content is now hashed during the upload process (e.g.,
  for Deel invoices and general document uploads) and stored in this new column. A new DataLoader is
  introduced to efficiently retrieve documents by their file hash, and caching is updated to include
  hash-based lookups. Integrations like Green Invoice and direct document insertion via resolvers
  are updated to handle the new `fileHash` field, initially setting it to `null` where the hash is
  not immediately available.
- **Database Schema Updates**: A new migration (`2025-09-19T10-06-24.add-documents-hash.ts`) is
  added to create a `file_hash` column (type `text`) in the `accounter_schema.documents` table. This
  migration is registered in `run-pg-migrations.ts`.
- **File Hashing Logic**: The `hashStringToInt` helper is imported and used to generate an integer
  hash from file content. This is applied in `deel.helper.ts` when uploading Deel invoices and in
  `upload.helper.ts` for general document uploads. The hashing process runs in parallel with other
  asynchronous operations like Cloudinary uploads and OCR data extraction.
- **Document Upload and Processing**: The `uploadDeelInvoice` function in `deel.helper.ts` now
  calculates and stores the file hash. The `getDocumentFromFile` function in `upload.helper.ts` is
  refactored to use a new helper `getDocumentFromUrlsAndOceData` and also calculates the file hash,
  passing it to the document creation logic. This ensures the hash is captured for newly uploaded
  documents.
- **Data Access Layer**: The `DocumentsProvider` in `documents.provider.ts` is updated with a new
  SQL query (`getDocumentsByHashes`) and a `DataLoader` (`getDocumentByHash`) to fetch documents
  efficiently using their file hash. Cache invalidation in `deleteDocument` now also clears entries
  based on `file_hash`.
- **Integrations and Resolvers**: The `insertDocuments` SQL query and related
  `IInsertDocumentsParams` are updated to include the `file_hash` field. In `documents.resolver.ts`
  and `green-invoice.helper.ts`, new document insertions explicitly set `fileHash` to `null` where
  the hash is not generated at that specific point in the workflow.
