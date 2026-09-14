---
'@accounter/server': patch
---

`TaxCategory.businesses` now fails loudly when the business batch fails.

`loadMany` reports a rejected batch as per-key `Error` values instead of throwing, so filtering them
out alongside the genuine misses would have made a database outage read as "no businesses use this
default".
