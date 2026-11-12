---
'@accounter/server': patch
---

Remote document upload (`batchUploadDocumentsFromUrls`) now accepts files served with a generic
content type (`application/octet-stream`, `binary/octet-stream`, or none) when their leading bytes
identify a PDF or a supported image — e.g. Stripe's hosted invoice and receipt PDF links. A declared
non-generic type outside the allowlist (such as `text/html`) is still refused without sniffing.

Because a generic type no longer stops an internal service's answer, every host is now resolved
before it is fetched, both the submitted URL and each redirect target. A name that resolves to a
private or loopback address, or doesn't resolve at all, is refused. The request's `Accept` header
also lists `application/octet-stream`, at low priority.
