---
'@accounter/email-ingestion-gateway': patch
---

Gateway: parse incoming MIME with `postal-mime` (as recommended by Cloudflare's email-handler docs)
instead of the hand-rolled parser. This decodes RFC 2047 encoded-word headers, so non-ASCII subjects
and sender display names (e.g. Hebrew `=?UTF-8?B?…?=`) are no longer stored as raw encoded strings —
fixing the email charge description that reads them. `extractFromMime` keeps the same public contract
(document-type filtering, size/count limits, nesting-depth guard, and the `From: <mailto:…>`
issuer-candidate heuristic) and now also forwards the email subject to the server for the charge
description.
