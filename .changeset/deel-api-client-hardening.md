---
'@accounter/server': patch
---

Harden the Deel API client: a request timeout, retries of 429/5xx responses (honouring
`Retry-After`), errors naming the endpoint, status and response body, paging through invoices
instead of silently stopping at 500, and refusing a truncated payment receipts list.
