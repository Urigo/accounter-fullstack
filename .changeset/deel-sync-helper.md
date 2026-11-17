---
'@accounter/server': patch
---

Move the Deel document sync out of the `fetchDeelDocuments` resolver into a
`syncDeelDocuments` helper. It also reports, per charge, whether the run created it and how many
Deel invoices it recorded on it, so other flows can reuse the sync and describe its changes. The
mutation's behaviour is unchanged.
