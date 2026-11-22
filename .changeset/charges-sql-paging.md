---
'@accounter/server': patch
---

The charges list pages in SQL: `getChargesByFilters` takes an optional `limit` / `offset` and returns
the total as `COUNT(*) OVER ()`, so All Charges and Missing Info Charges load one page of rows from
the database instead of every matching charge. Callers that need every row pass no window and are
unchanged; the concrete charge-type filter still pages in memory.
