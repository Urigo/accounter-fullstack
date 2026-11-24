---
'@accounter/server': patch
'@accounter/client': patch
---

- **Foreign-currency depreciation records**: an asset paid for in a foreign currency (e.g. USD) is
  now depreciated, reported and disposed of at its cost in the local currency: the amount converted
  at the Bank of Israel rate of the purchase charge's contract date (its earliest document date,
  else its earliest misc expense, else its first payment date, else the activation date). A new
  optional `localAmount` on depreciation records overrides the converted cost; on update, `null`
  clears it and leaving it out keeps it.
- `DepreciationRecord` exposes `localAmount`, `localAmountOverride`, `exchangeRate` and
  `exchangeRateDate`; `remainingCost` is always in the local currency.
- **Cost refunds of a foreign-currency asset are entered in the asset's currency**
  (`originalAmount`, stored in the new `depreciation_disposals.original_amount` /
  `original_currency`, with no local `disposed_cost`). A refund from activation converts at the
  asset's cost-basis rate (local cost ÷ amount, so an override carries through); a refund from the
  refund date converts at the refund charge's rate. `DepreciationDisposal` exposes `originalAmount`
  and `exchangeRate`, and the preview the rate.
- **Ledger**: on a charge carrying such refunds, the refunded amounts are reconciled in the asset's
  currency against what the charge credits to its tax category (a mismatch is a ledger error), and
  the local-currency gap left there is booked as an exchange-rate difference, instead of failing
  the local-currency proceeds check.
- The ledger of a charge carrying depreciation records books its invoice-to-payment exchange
  difference to the exchange-rates account instead of the asset account, including an acquisition
  entered as misc expenses without documents, so the asset account matches the depreciation
  report's cost.
- The depreciation record row and form show the converted local cost and take an optional local
  cost override; the disposal modal takes a foreign-currency asset's refund in the asset's currency.
