---
'@accounter/server': patch
---

Record disposals of depreciated assets (sale, write-off) and supplier cost refunds: new
`depreciation_disposals` table, GraphQL CRUD with validation, a disposal preview query, disposal
gain/loss and depreciation-correction tax-category settings, and charge merge / empty-charge
handling. A cost refund is a correction to the asset's cost, not a sale: it has no proceeds and no
gain or loss, takes a refund mode (`FROM_ACTIVATION` by default, or `FROM_REFUND_DATE`), and
reports its cost reduction and depreciation correction. Depreciation categories accept rates from
0% (not depreciated) to 100%.
