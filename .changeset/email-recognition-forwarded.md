---
'@accounter/server': patch
---

Recognize the issuing business for **manually forwarded** invoice emails. The real issuer address
often survives only inside the quoted "Forwarded message" header block (e.g. the original
`Reply-To`), which the gateway previously ignored. The gateway now also recovers
`From`/`Reply-To`/`Sender` addresses from forwarded-header blocks, and the server tries every
candidate (case-insensitively) until one matches a business — so a forwarded Cloudflare invoice is
attributed to the right business and its email-processing config (e.g. "ignore the body") is applied
instead of falling back to default treatment.
