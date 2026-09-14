---
'@accounter/server': minor
'@accounter/client': minor
---

Add a re-run OCR action for documents stuck on `UNPROCESSED`.

A batch of documents was inserted with `type = 'UNPROCESSED'` and no extracted information at all —
no amount, date, serial or counterparty — because the email-ingestion path catches every OCR failure
and falls back to `UNPROCESSED` (`email-ingestion-ingest.provider.ts`). The document is still
inserted and the ingest still reports `INSERTED` with its idempotency key persisted, so replaying
the source email answers `DUPLICATE` and cannot recover it. The Cloudinary `file_url` survives,
though, which is enough to extract from the file again.

New mutations `reprocessDocumentOcr(documentId)` and `batchReprocessDocumentsOcr(documentIds)`
re-fetch that stored file through the existing SSRF-hardened `fetchRemoteDocument`, run it back
through `getOcrData`, and report which fields were filled. Surfaced in the client as a "Re-run OCR"
item in the document actions menu and, on the documents screen, a bulk button over the unprocessed
documents currently listed (pair it with the "Invalid documents only" filter).

The write is additive on purpose: a column is filled only where the document is currently empty, so
a value an accountant corrected by hand is never overwritten. The exception is `documentType`, which
is replaced only while the document is still `UNPROCESSED`. A pass that extracts nothing new writes
nothing at all, rather than bumping `updated_at` and dragging the charge's accountant approval back
to `PENDING` for no gain.

Two limits worth knowing. Nothing in the schema records whether OCR ever ran, failed, or was
deliberately skipped, so the action cannot tell a recoverable failure from a document that will
always be unreadable — retrying the latter costs an OCR pass and changes nothing. And the mutation
holds the request open for the whole extraction (tens of seconds per document, no job queue in this
server), which is why a batch is capped at 20 documents and runs three at a time.
