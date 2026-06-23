---
'@accounter/email-ingestion-gateway': minor
---

Gateway treatment step (Workstream C): after the server recognizes the issuing business, the gateway
now assembles the final document set from the returned `businessEmailConfig` — filtering attachments
by the allowed types, rendering the email body to a PDF (bundled Chromium via Playwright) when no
business is recognized or `emailBody` is enabled, and fetching documents from configured
`internalEmailLinks` in the body (SSRF-hardened: host/path allowlist, private-IP/redirect blocking,
content-type allowlist, size caps). Orchestration runs treatment between control and ingest, so the
document set (and emptiness) is decided post-recognition.

Note: the gateway runtime must provide a Chromium binary (e.g. `playwright install --with-deps
chromium`). Document bytes are still transported as metadata only — inline byte transport and
server-side persistence land in Workstream D.
