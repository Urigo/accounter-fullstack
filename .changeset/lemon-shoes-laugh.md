---
'@accounter/server': patch
---

Email ingestion: set a descriptive charge description matching the legacy gmail-listener —
`Email documents: <subject> (from: <sender>, <date>)` — instead of the bare
`email-ingestion: <messageId>`. The email subject, sender, and received date are threaded through
`IngestEmailInput` (new optional `subject`/`sender`/`receivedAt` fields) → the `ingestEmail`
resolver → `EmailIngestionIngestProvider`, with graceful fallback to the message id when any field
is missing. The received date is formatted in UTC so the same email produces a stable description
across dev/CI/prod.
