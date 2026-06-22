---
'@accounter/email-ingestion-gateway': patch
---

Gateway: capture the email body and issuer (`From: <mailto:…>`) candidates during MIME extraction,
and forward sender evidence to the control endpoint so the server can recognize the issuing business
(Workstream B). Attachment-less emails are no longer treated as an extraction failure — the body may
still yield a document during treatment, so emptiness is decided later with the server ingest as the
backstop.
