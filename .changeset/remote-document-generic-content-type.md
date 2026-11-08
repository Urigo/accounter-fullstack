---
'@accounter/server': patch
---

Remote document upload (`batchUploadDocumentsFromUrls`) now accepts files served with a generic
content type (`application/octet-stream`, `binary/octet-stream`, or none) when their leading bytes
identify a PDF or a supported image — e.g. Stripe's hosted invoice and receipt PDF links. A declared
non-generic type outside the allowlist (such as `text/html`) is still refused without sniffing.
