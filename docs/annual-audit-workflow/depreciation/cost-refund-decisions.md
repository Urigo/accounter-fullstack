# Cost refunds of depreciated assets: decisions

The record of the assessment of the
[acquisition cost-refund spec](./acquisition-cost-refund-test-spec.md) against the depreciation PR
chain, item by item: which side was right, and what changed.

Before the assessment, the chain treated a supplier's cost refund as a **partial sale on the refund
date**. That booked depreciation on the refunded slice up to the refund date, a capital gain, no
exchange difference on the refund receivable, and left a balance in the clearing account. The
assessment settled that **a cost refund is a correction to cost, booked as ordinary income**.

## Decisions

| Item   | Question                                                                                                                    | Right side | What changed                                                                                                                                                                                                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Is a refund of the price a partial sale, or a correction of the cost?                                                       | Spec       | `COST_REFUND` is a cost correction, never a sale or write-off: no proceeds and no gain or loss. Sales and write-offs are unchanged.                                                                                                                                                                                       |
| **C2** | What happens to the depreciation already booked on the refunded part?                                                       | Spec       | In the refund year, the depreciation booked through the year before is recomputed on the corrected cost, and the excess is recaptured. Years before stay as filed; the refund year and later depreciate the corrected cost for full years. A full refund closes the asset and recaptures all of its depreciation.         |
| **C3** | Rounding: agorot (spec) or whole shekels (system)?                                                                          | System     | Depreciation stays in whole shekels per asset per year, and the recapture is taken between rounded amounts. Ledger amounts converted from a foreign currency stay in agorot. The spec was updated.                                                                                                                        |
| **C4** | When does depreciation end?                                                                                                 | Spec       | On activation + N years − 1 day (N = 100 ÷ rate), computed in code instead of the old SQL expression: 2031-08-19 for 12.5% from 2023-08-20. For a fractional N, whole years plus round(fraction × 365) days, minus 1 (a proposed rule, to confirm). Assets whose end year moves were listed for review against real data. |
| **L1** | Is the exchange difference on the refund receivable booked?                                                                 | Spec       | Yes. The refund charge's credit to the clearing account is reconciled in the asset's currency, and the local-currency gap to the cost reductions is booked to exchange rates (the ₪5,000 loss). A proceeds-vs-charge check reports a charge that does not carry the money for its events.                                 |
| **L2** | How do non-depreciated assets (trademarks) take part?                                                                       | Spec       | Through 0% depreciation categories: cost is tracked and refunds and sales apply, but nothing is depreciated and nothing recaptured. They are left out of the depreciation report.                                                                                                                                         |
| **L3** | Who allocates a refund (goodwill first, then pro rata)?                                                                     | —          | Deferred: the user enters each asset's part. An allocation helper is optional later work.                                                                                                                                                                                                                                 |
| **L4** | Where does the income go?                                                                                                   | Spec       | The recapture (or, for a later rebate, the excess over book value) is credited to a new **depreciation correction** tax category, ordinary income. No gain/loss rows for refunds. Its sort and IRS codes are to be confirmed with the CPA.                                                                                |
| **L5** | What date do the refund's entries carry?                                                                                    | System     | Every entry of the refund charge is dated the refund date, since the earlier year is filed. The cost reductions are converted at the asset's historical cost-basis rate, and the recapture entry names the years it corrects.                                                                                             |
| **L6** | Per-asset or aggregate ledger accounts?                                                                                     | System     | The ledger stays on aggregate accounts: one accumulated-depreciation account and the depreciation expense accounts by type (R&D, G&A, marketing). Per-asset figures come from the engine and the depreciation report. Splitting accumulated depreciation by asset class is deferred.                                      |
| **L7** | At what rate is a USD acquisition entered without documents converted, and where does the payment's exchange difference go? | Spec       | At the contract date, which is the assets' activation date: a foreign-currency asset's cost basis converts at the rate of its activation date. When the acquisition is entered as misc expenses on a charge carrying assets, the payment's exchange difference goes to exchange rates instead of failing.                 |
| **L8** | Is a fee withheld from a net receipt split out automatically?                                                               | —          | Deferred: the fee is entered as a misc expense.                                                                                                                                                                                                                                                                           |

## Refund modes

The user picks the mode per refund:

- **From activation** (the default, also when no mode is stored) is for a refund of the original
  price. The cost is corrected from activation, as described in C2.
- **From the refund date** is for a later rebate. The year splits at the refund date: the cost drops
  by the refund and accumulated depreciation is unchanged, so the book value drops by it. Income
  arises only when the refund exceeds the book value.

A refund of an asset recorded in a foreign currency is entered in that currency. From activation, it
converts at the asset's cost-basis rate; from the refund date, at the refund charge's rate.

## Found by the scenario test

The DB-backed test of the spec found three gaps, fixed in the chain:

- **An acquisition of several assets on one charge.** The asset account of a cost reduction was the
  tax category of the charge that bought the asset. The acquisition, entered as misc expenses, has
  none, so its refunds failed, and with one they would all have credited a single account. An asset
  record can now name its own asset account (`asset_tax_category_id`, `assetTaxCategoryId` in the
  API, an "Asset account" picker in the record forms); the purchase charge's tax category remains
  the fallback. Without either, the refund reports that the asset has no account.
- **Proceeds checked on partial data.** When an event's rows could not be built, its cost reduction
  was still counted in what the charge should carry, so the exchange row was booked against money
  never moved out of the clearing account. Now neither the proceeds check nor the exchange row runs
  when any event of the charge failed; the event's error is still reported.
- **A fully refunded foreign-currency asset in later years.** It stayed in the depreciation report
  as a row of zeros. The report now leaves out an asset whose events closed it before the year
  (nothing on its books during the year). A record without an amount still shows, as a cue to fill
  it in.

## Open points

1. Sort and IRS codes of the depreciation correction category (CPA).
2. The end-date rule for a fractional N (33%, 15%, 7%…).
3. Sign-off on the real-data review of assets whose end year moves (C4).
