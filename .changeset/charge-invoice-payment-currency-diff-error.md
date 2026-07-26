---
'@accounter/server': patch
---

Notify when a charge's main document and main transaction settle in different currencies. The ledger
`validate` resolver now surfaces an error (shown by the client's `ChargeErrors` component) when a
charge's main financial document currency differs from its main transaction currency while the
`invoice_payment_currency_diff` flag is off, prompting the user to turn on the "Invoice-Payment
currency difference" switch. The check is display-only — it does not alter ledger record generation
or storage, only fires when each side resolves to a single differing currency, and falls back to no
extra errors if the underlying meta lookups fail.
