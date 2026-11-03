---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

Create a charge for uploaded documents from the MCP.

- `accounter_upload_documents` now takes exactly one of `chargeId` (an existing charge) or
  `newCharge` (`{ description?, tagIds? }`). `newCharge` creates one charge for all the call's
  documents, the same document-only charge the ingestion email produces. The result returns its
  `chargeId` with `chargeCreated: true`.
- `batchUploadDocuments`, `batchUploadDocumentsFromUrls` and `batchUploadDocumentsFromGoogleDrive`
  accept a `newCharge: NewDocumentsChargeInput` (description and tags) when no `chargeId` is given.
  The new charge is created after processing, in one transaction with its tags and documents, and
  only if at least one document succeeded, so a failed batch no longer leaves an empty charge.
- `batchUploadDocuments` now reports each file's failure on its own position instead of failing the
  whole batch, and returns results in input order (they used to come back in completion order).
