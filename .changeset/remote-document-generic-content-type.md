---
'@accounter/server': patch
---

Remote document upload (`batchUploadDocumentsFromUrls`) now accepts files served with a generic
content type (`application/octet-stream`, `binary/octet-stream`, or none) when their leading bytes
identify a PDF or a supported image — e.g. Stripe's hosted invoice and receipt PDF links. A declared
non-generic type outside the allowlist (such as `text/html`) is still refused without sniffing.

Because a generic type no longer stops an internal service's answer, every host is now resolved
before it is fetched, both the submitted URL and each redirect target. A name that resolves to a
private or loopback address, or doesn't resolve within the fetch's 30-second deadline, is refused.
An IPv6 literal that embeds an IPv4 address is judged by the address it embeds, whichever way it is
written. The request's `Accept` header also lists `application/octet-stream`, at low priority, and a file
typed from its bytes gets the matching extension (`/invoice.bin` holding a PDF is `invoice.pdf`).
