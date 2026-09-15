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

The write is additive on purpose: a column is filled only where the document is empty, so a value an
accountant corrected by hand is never overwritten. The exception is `documentType`, which is replaced
only while the document is still `UNPROCESSED`. A pass that extracts nothing new writes nothing at
all, rather than bumping `updated_at` and dragging the charge's accountant approval back to `PENDING`
for no gain.

That rule is enforced by the UPDATE statement rather than by the caller. Minutes pass between reading
a document and writing it back, and deciding which columns are blank from the pre-OCR read would mean
overwriting a field an accountant filled during the extraction, using a decision made before they
touched it. `COALESCE(column, $param)` — the reverse of the usual argument order — makes "never
overwrite" a property of the statement, and repeating the conditions in its `WHERE` clause keeps a
pass with nothing to contribute from matching any row at all.

The document's owner is checked against the request's write target up front. Reads span the whole
business scope while writes are pinned to one business, so the all-documents screen can list a row
this request cannot write to; catching that late would mean paying for a download and an OCR call
first.

The documents table gains a selection column, keyed by document id so a selection survives paging,
sorting and filtering, and a batch menu beside it offering "Re-run OCR" and "Delete" over the
selected rows. It also gains an opt-in `preview` column showing each document's stored image,
hidden by default because it costs one image request per visible row.

When the stored original cannot be sent to OCR — the two MIME allowlists in play disagree in both
directions, so a GIF is refused by the fetch layer and a HEIC is refused by the model — the Cloudinary
`.jpg` derivative is used instead rather than failing.

Two limits worth knowing. Nothing in the schema records whether OCR ever ran, failed, or was
deliberately skipped, so the action cannot tell a recoverable failure from a document that will
always be unreadable — retrying the latter costs an OCR pass and changes nothing. And the mutation
holds the request open for the whole extraction (tens of seconds per document, no job queue in this
server), which is why a batch is capped at 20 documents and runs three at a time.
