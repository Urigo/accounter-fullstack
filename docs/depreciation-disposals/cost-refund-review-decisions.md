# Cost refunds on acquired assets: decisions after the spec-vs-code review

## Context

The test spec [`acquisition-cost-refund-test-spec.md`](./acquisition-cost-refund-test-spec.md)
describes this scenario:

1. **Acquisition.** An asset-deal acquisition on 2023-08-20 for USD 480,000.
2. **Refund.** A supplier refunds USD 100,000 on 2024-04-14. The acquired business was already owed
   this amount on the acquisition date, but the purchase-price allocation (PPA) missed it.

A review compared the spec with the depreciation PR chain:

| PR    | Scope                    |
| ----- | ------------------------ |
| #5136 | Engine fixes             |
| #5129 | Disposals API            |
| #5131 | Disposal ledger          |
| #5132 | Report                   |
| #5149 | USD depreciation records |

The review found the following.

**What matches:**

- 2024 year-end cost, accumulated depreciation and net book value per asset.
- The total P&L effect.
- The schedule from 2025 onward.

**What differs:**

- The treatment model.
- The tax character of the income.
- The FX handling.
- A few ledger mechanics.

This document records, item by item, which side is right and what has to change. The item IDs
(C1–C4, L1–L8) follow the review.

## Decision summary

| #   | Topic                           | Decision                                                    | Change in  |
| --- | ------------------------------- | ----------------------------------------------------------- | ---------- |
| C1  | Cost-refund model               | **Spec**: a correction to cost, not a sale                  | Code       |
| C2  | What the correction is and when | **Spec** on the account; **code** on the date (refund year) | Code, spec |
| C3  | Rounding                        | **Code**: whole shekels                                     | Spec       |
| C4  | Natural end date                | **Spec**: 2031-08-19 (the code is one day short)            | Code       |
| L1  | FX on the refund                | **Spec**: book the FX difference on the refund receivable   | Code       |
| L2  | Assets that aren't depreciated  | **Spec**: trademarks take their share of the refund         | Code       |
| L3  | Allocating the refund           | **Code**: manual entry is acceptable                        | Optional   |
| L4  | Tax character                   | **Spec**: ordinary income, not a capital gain               | Code       |
| L5  | Value dates                     | **Code**: keep the refund-year dates                        | Spec       |
| L6  | Account granularity             | **Code**: aggregate accounts are acceptable                 | Spec       |
| L7  | Booking the acquisition         | **Spec**: split by asset, contract-date rate, payment FX    | Code       |
| L8  | SWIFT fee in a net receipt      | **Spec** on the result; a manual misc expense is OK for now | None now   |

---

## Code changes, by priority

### P1. FX on cost refunds, and the proceeds-vs-charge check (L1)

**Problem.**

- Disposals are ILS only, and a `COST_REFUND` forces proceeds to equal the disposed cost.
- The refund charge values the USD credit at the refund-date rate (₪365,000). The disposals remove
  ₪355,200.
- The FX loss (₪5,000) is never booked.
- A ₪9,800 residual stays in the clearing account. Nothing flags it.

**Why the spec is right.** The asset's cost entered the books at 3.700, so the refunded part has to
leave at 3.700. The cash arrives at 3.650. The difference is an FX result on a USD receivable. It is
neither cost nor income.

**Change.**

1. Allow a cost refund on a foreign-currency asset to be entered in the asset's currency.
2. Convert that amount at the asset's cost-basis rate, the same rate #5149 uses for the record.
3. In the refund charge, book the gap between that ILS amount and the charge's own ILS valuation to
   the FX tax category.
4. Build the proceeds-vs-charge check that the plan called for and #5131 didn't build. When the
   total disposals linked to a charge don't reconcile with the charge's valuation, raise a ledger
   error.

**Acceptance.**

- The refund charge books R5–R7 from spec §4.4: ₪364,927.00 to the bank, ₪73.00 in fees and
  ₪5,000.00 FX loss.
- No residual remains in any clearing account.
- A deliberately mismatched disposal produces a ledger error.

### P2. A cost refund is a correction to cost, booked as ordinary income (C1, C2, L4)

**Problem.**

- The engine treats a `COST_REFUND` as a partial sale on the refund date.
- In the refund year it keeps depreciating the refunded slice from Jan 1 to the refund date. It then
  releases that slice's accumulated depreciation as a gain on disposal.
- That gain is mapped to capital-gain codes: sort code 991 and IRS code 5210.

**What goes wrong.**

- **Phantom depreciation.** The engine depreciates cost that never really existed. The clearest
  case: ₪6,369 of goodwill depreciation in 2024, on goodwill whose cost turns out to be zero.
- **Inflated lines.** Depreciation expense and income are each overstated by ₪14,628. The net result
  is the same.
- **Wrong tax character.** A capital gain is offset against losses differently, and it changes the
  reported income mix. For a preferred technology enterprise it can change the tax itself.
- **Inflated R&D.** If the depreciation is typed R&D, the R&D expense in the tax-ruling ratio is
  overstated.

**Why the spec is right.** A refund of the original price is not a sale. Nothing was disposed of on
the refund date: the purchase price simply bought fewer intangibles than the PPA said. The extra
depreciation claimed in filed years is a deduction that has to be reversed, which makes it ordinary
income.

**Change.**

1. **Engine.** A `COST_REFUND` with the mode "from activation" (the default for refunds of the
   original price) works like this:
   - The asset's cost is reduced from its activation date.
   - In the refund year Y, recapture = Σ over filed years (depreciation as filed − depreciation
     recomputed on the corrected cost).
   - From year Y onward, depreciation is computed on the corrected cost for full years.
   - Nothing is depreciated on the refunded slice in year Y.
   - When the asset's whole cost is refunded (goodwill here), the asset closes and all of its
     depreciation is recaptured.
2. **Optional second mode, "from refund date",** for later rebates that are not part of the original
   price (for example, a volume rebate):
   - Reduce the remaining cost from the refund date.
   - Keep depreciating the remainder.
   - Book income only if the refund is larger than the net book value.
3. **Keep the sale/disposal model for `SALE` and `WRITE_OFF`.** Capital-gain codes stay correct
   there.
4. **Settings.** Add a "prior-year depreciation correction" tax category to the depreciation
   settings. Map it to ordinary income. Confirm the exact sort and IRS codes with the CPA.
5. **Ledger.** Recapture rows are Dr accumulated depreciation / Cr prior-year depreciation
   correction. They are dated in the refund year (see L5).
6. **Report (#5132).** Show a cost refund as a reduction of cost plus a recapture column, not as a
   disposal row.

**Acceptance.** The spec's §3.3 and §3.4 hold, in whole shekels (see the spec changes below):

- 2024 depreciation is on the corrected cost only.
- 2024 has no goodwill depreciation.
- The recapture equals the excess of 2023 as filed over 2023 recomputed on the corrected cost.

### P3. Booking the acquisition (L7)

**Problem.**

- A common charge's document entries go to a single tax category, so a purchase spanning several
  assets has to be split by hand.
- An acquisition booked with misc expenses has no document. #5149 then falls back to the payment
  date for the rate: 3.680 instead of 3.700.
- The FX on the payment to the seller (₪8,800) goes to the FX account only when the seller's balance
  comes from a document entry.

**Why the spec is right.**

- An asset's cost is set at the rate on the contract (acquisition) date, not the payment date.
- The difference on the payable is FX no matter how the payable was created.

**Change.**

1. Use the misc-expense invoice and value dates as the document date in #5149's rate-date chain.
2. Route FX on a seller's balance to the FX category also when the balance comes from misc expenses.
3. Consider letting depreciation records drive the split of a multi-asset purchase in the
   acquisition charge's ledger.

**Acceptance.** The spec's §4.1 and §4.2 hold without any ILS overrides.

### P4. Assets that aren't depreciated take part in the cost structure (L2)

**Problem.** Disposals attach only to depreciation records. Trademarks have no record, so they can't
take their share of the refund. Trademarks stay at ₪148,000 instead of ₪133,200, unless the
reduction is booked by hand.

**Why the spec is right.** Trademarks are part of what was bought. If they are left out, their share
of the refund is pushed onto the depreciable assets, which understates the deduction, or else the
trademarks stay overstated.

**Change.** Support depreciation records in a 0% category: assets that are tracked and can take part
in refunds, but that the depreciation report leaves out. The same mechanism covers land and other
assets that aren't depreciated.

**Acceptance.**

- Spec R4 (₪14,800) is produced through the same refund flow.
- Trademarks still never appear in the depreciation report (spec §6.6).

### P5. Natural end date off by one day (C4)

**Problem.** For activation on 2023-08-20 at 12.5%, the stored expiry is 2031-08-18.

**Correct value: 2031-08-19.**

- 2023 uses 134/365 of a year.
- The eighth year therefore needs 231/365 of a year: Jan 1 to Aug 19, 2031.
- The asset's last day is the day before the anniversary of its activation.

**Impact today.** None on the amount, because the final year takes whatever is left.

**Where it will matter:**

- a disposal dated on the last day;
- any proration of the final year;
- the end date shown on the report.

**Acceptance.** Expiry = activation + N years − 1 day, where N is a whole number of years.

### Optional

- **L3: allocation helper.** A helper that proposes how to split a refund over an acquisition's
  records: the residual (goodwill) first, then pro rata by original cost. Every amount stays
  editable.
  - The allocation is an accounting judgment for each case. A refund tied to one specific asset
    belongs to that asset alone.
  - Entering the amounts by hand is acceptable.
- **L8: fees in a net receipt.** Today, a net bank receipt (USD 99,980) needs a manual misc expense
  for the fee (₪73).
  - A general way to split a fee out of a transaction would remove that step.
  - The requirement: the cost is reduced by the gross amount, the fee is a bank expense, and nothing
    is left unbalanced at the supplier or absorbed as FX.
- **L6: accumulated-depreciation granularity.** A single accumulated-depreciation account, with
  expense split by type, is acceptable for the ledger, because per-asset detail lives in the
  depreciation register.
  - Financial statements will eventually need intangibles shown net, separately from fixed assets.
  - A split by asset class is worth planning (the known B6 item 2). It does not block this work.

---

## Changes to the spec (where the code is right)

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3  | Round each asset's yearly depreciation, the recapture and the schedule to **whole shekels**, as filed years were computed. Ledger amounts that come from FX conversion (₪364,927.00, ₪73.00, ₪5,000.00) stay in agorot. Assertions are exact; no ±1 tolerance.                                                                                                                                                                                                |
| L5  | All refund-charge entries get the **refund-year dates** (invoice and value date 2024-04-14). The current spec back-dates value dates to 2023-08-20 (R1–R4) and 2023-12-31 (R8–R10); that would put entries into 2023, which is filed and locked, and would change 2023 balance reports. The historical rate (3.700) is carried explicitly as the conversion basis of the cost rows, and the recapture rows say in their description that they relate to 2023. |
| L6  | Assert the ledger on the **system's aggregate accounts**: depreciation expense by type (R&D / G&A / marketing) and one accumulated-depreciation account. Per-asset figures are asserted against the engine and report output (§3), not the ledger.                                                                                                                                                                                                            |

The C2 account decision needs no spec change: the spec already books the recapture to a
prior-year-depreciation-correction account. Only its date changes, under L5.

---

## Open questions

1. **Sort and IRS codes for the "prior-year depreciation correction" category.** To be confirmed
   with the CPA.
2. **The "from refund date" mode for `COST_REFUND`.** Needed now, or later when the first real case
   of a post-purchase rebate appears?
3. **The default mode when a refund is entered.** Should a refund linked to the acquisition charge
   default to "from activation"?

## Verification

Once the changes are in, encode the updated spec as tests:

- §3 as engine unit tests;
- §4 as ledger-generation tests for the acquisition, the payment, the refund and the two yearly
  depreciation charges;
- §5 as a balances assertion across those charges.
