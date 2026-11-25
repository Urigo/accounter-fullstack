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
  asset's cost-basis rate (local cost ÷ amount, so an override carries through), allocated
  cumulatively in whole shekels so that refunds of the whole amount, however split, add up to
  exactly the asset's cost; a refund from the refund date converts at the refund charge's rate. `DepreciationDisposal` exposes `originalAmount`
  and `exchangeRate`, and the preview the rate.
- **Ledger**: on a charge carrying such refunds, the refunded amounts are reconciled in the asset's
  currency against what the charge credits to its tax category (a mismatch is a ledger error), and
  the local-currency gap left there is booked as an exchange-rate difference, instead of failing
  the local-currency proceeds check. Such refunds must be invoiced in the asset's currency, and
  their charge may carry no other asset events (both are ledger errors).
- **Payment exchange difference**: the ledger of a charge that bought an asset recorded in a
  foreign currency now books its invoice-to-payment exchange difference to the exchange-rates
  account instead of the charge's tax category (the asset account), including an acquisition
  entered as misc expenses without documents (which used to fail to find a tax category), so the
  asset account matches the depreciation report's cost. Charges of assets recorded in the local
  currency are unchanged.
- **Per-record asset account**: a new optional `depreciation.asset_tax_category_id`
  (`assetTaxCategoryId` on the record inputs, `assetTaxCategory` on `DepreciationRecord`) names the
  asset's cost account. Disposal and refund rows take it, falling back to the tax category of the
  charge that bought the asset, so one charge can buy several assets (e.g. an acquisition booked
  through misc expenses).
- The depreciation record row and form show the converted local cost and take an optional local
  cost override and an asset account; the disposal modal takes a foreign-currency asset's refund in
  the asset's currency.
