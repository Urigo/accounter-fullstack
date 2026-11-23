---
'@accounter/server': patch
'@accounter/client': patch
---

- **Foreign-currency depreciation records**: an asset paid for in a foreign currency (e.g. USD) is
  now depreciated, reported and disposed of at its cost in the local currency: the amount converted
  at the Bank of Israel rate of the purchase charge's document date (falling back to its first
  payment date, then to the activation date). A new optional `localAmount` on depreciation records
  overrides the converted cost; on update, `null` clears it and leaving it out keeps it.
- `DepreciationRecord` exposes `localAmount`, `localAmountOverride`, `exchangeRate` and
  `exchangeRateDate`; `remainingCost` is always in the local currency.
- Disposals of foreign-currency assets are no longer rejected.
- The ledger of a charge carrying depreciation records books its invoice-to-payment exchange
  difference to the exchange-rates account instead of the asset account, so the asset account
  matches the depreciation report's cost.
- The depreciation record row and form show the converted local cost and take an optional local
  cost override.
