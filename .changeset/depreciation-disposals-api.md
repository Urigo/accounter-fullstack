---
'@accounter/server': patch
---

Record disposals of depreciated assets (sale, supplier cost refund, write-off): new
`depreciation_disposals` table, GraphQL CRUD with validation, a disposal preview query, disposal
gain/loss tax-category settings, and charge merge / empty-charge handling.
