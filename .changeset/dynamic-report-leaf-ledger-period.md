---
'@accounter/client': patch
---

Dynamic report: an expanded leaf's ledger records are now filtered by the report's period and owner,
so they add up to the leaf's figure. In every ledger-records table, sorting by Date descending now
fully reverses the chronological order (same-day records included), so the running balance column
reads in order in both directions; the records array is also no longer sorted in place in urql's
cache.
