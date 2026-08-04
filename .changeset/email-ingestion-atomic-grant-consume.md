---
'@accounter/server': patch
'@accounter/email-ingestion-gateway': patch
---

Fix v2 email ingestion stranding emails on a failed document upload. The server consumed the
single-use grant in its own committed transaction before the fallible, non-transactional document
preparation (Cloudinary upload, OCR), so any failure there left the grant burned with **nothing**
persisted — no document, no charge, no quarantine, no idempotency record — and every retry then hit
the already-consumed grant (`GRANT_INVALID` → `REJECTED`). The underlying error was also swallowed
by the ingest resolver, making the failure invisible server-side.

Now the server validates the grant read-only up front, prepares documents while the grant is still
intact, and consumes the grant **atomically inside the write transaction**, so a failure rolls the
consume back and the email stays retryable. A Cloudinary/prep failure is turned into a new
`UPLOAD_FAILED` quarantine (recorded and reprocessable) instead of throwing raw, while unexpected
errors still surface with the grant unconsumed. The ingest resolver now logs the real cause (keyed
by `correlationId`) rather than returning a bare `CommonError`.
