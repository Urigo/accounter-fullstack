---
'@accounter/server': minor
---

Track the Israeli consumer price index (CPI) in the database. A new `price-indexes` module syncs CBS
price indexes (api.cbs.gov.il) into the global `price_index_values` / `price_index_bases` tables: a
full backfill at startup on an empty table and a daily incremental run at 17:00 UTC (disable with
`PRICE_INDEX_SYNC_ENABLED=0`). `PriceIndexesProvider` resolves the "known" index (Income Tax
Ordinance s.88) or the index for a month and links amounts between any two dates across base
changes, matching the official CBS calculator. New GraphQL: `priceIndexValues`, `priceIndexLinkage`
and the super-admin `syncPriceIndexes` mutation.
