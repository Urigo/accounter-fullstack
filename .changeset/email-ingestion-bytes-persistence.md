---
'@accounter/email-ingestion-gateway': minor
'@accounter/server': minor
---

Email ingestion v2 — document bytes transport & persistence (Workstream D).

The gateway now inlines each treated document's bytes (base64, Option B) into the `ingestEmail`
mutation, and the server ingest step persists them: under the grant tenant's RLS context it uploads
each document to Cloudinary, creates a charge, and inserts the documents — attributed to the
recognized issuing business (read back from the grant's `business_id`, never trusted from gateway
input) as the document counterparty, with the legacy per-document hash dedup skip. Documents are
stored as `UNPROCESSED` (classification/OCR happens later via the normal flow).

Because the gateway control-plane caller has no auth session, persistence uses inline,
tenant-pinned SQL rather than the auth-coupled `DocumentsProvider` / `ChargesProvider` /
`getDocumentFromFile` (the same constraint behind the existing idempotency/dedup/quarantine writes).
Metadata-only ingest calls (no inline bytes) remain a no-op for persistence.
