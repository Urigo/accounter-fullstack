---
'@accounter/server': patch
---

Harden the Deel API client: a request timeout (covering the response body too), retries of 429/5xx
responses (honouring `Retry-After`), errors naming the endpoint, status and response body, and
schema mismatches reported once per field with the values Deel sent. Invoices are paged by the rows
each page returned and de-duplicated instead of silently stopping at 500; payment receipts follow
Deel's cursor through every page. An empty invoice `due_date` no longer becomes "Invalid Date", and
a payment method type Deel adds no longer fails the whole receipts list.
