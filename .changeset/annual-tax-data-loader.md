---
---

Internal refactor, no behaviour change: the per-year books loading and tax computation that the
SHAAM 6111 report runs (ledger up to year end, financial entities, sort codes, P&L amounts, R&D over
three years and `calculateTaxAmounts`) moved out of `getShaam6111Data` into a reusable
`loadAnnualTaxData` helper in the reports module, so form 1214 can build on the same year data. No
release.
