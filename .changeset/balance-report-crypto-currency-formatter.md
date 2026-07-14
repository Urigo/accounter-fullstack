---
'@accounter/client': patch
---

Fix a crash in the transactions balance report when a period's per-currency breakdown includes a
crypto currency. Crypto currencies (`USDC`, `ETH`, `GRT`) are not valid ISO 4217 codes, so
`getCurrencyFormatter` threw `RangeError: Invalid currency code` when building an
`Intl.NumberFormat` with `style: 'currency'`. The formatter now falls back to decimal formatting
with the currency symbol as a prefix for non-fiat currencies (placing the minus sign before the
symbol for negatives, matching fiat notation), leaving fiat currency formatting unchanged.
