# Test case spec: asset-deal acquisition followed by a cost refund

A business buys the activity of another company for USD. This is an asset deal, not a share
purchase. Part of the price is allocated to depreciable intangibles.

In the next tax year, a supplier refunds an amount that the acquired business was already owed on
the acquisition date. The purchase-price allocation (PPA) missed this amount, so the refund lowers
the cost of the acquired intangibles. The acquisition year is already filed, so the correction is
booked in the year of the refund.

All names, dates, amounts, exchange rates and allocation shares here are fictional. The spec lists
inputs and expected outputs only. It does not assume how the code computes them.

> **Revision.** This is the original spec, updated with the decisions of its assessment (see
> [cost-refund-decisions.md](./cost-refund-decisions.md)):
>
> - **C3, whole shekels.** Each asset's yearly depreciation, the recapture and the schedule are in
>   whole shekels. Ledger amounts converted from USD stay in agorot. All assertions are exact.
> - **L5, refund-year dates.** Every entry of the refund charge is dated the refund date, 2024-04-14
>   (invoice and value date). The cost reductions are converted at the historical cost-basis rate
>   (3.700), and the recapture entries say that they relate to 2023.
> - **L6, aggregate accounts.** The ledger uses the system's aggregate accounts: depreciation
>   expense by type (R&D, G&A), one accumulated-depreciation account, and a clearing account `P`
>   that the refund charge books the credit note to. Per-asset figures are asserted against the
>   depreciation engine and the depreciation report.
>
> The DB-backed test of this spec is
> `packages/server/src/modules/ledger/__tests__/acquisition-cost-refund.integration.test.ts`.

---

## 1. Inputs

### 1.1 Exchange rates (USD → ILS)

| Date       | Rate  | Used for                                        |
| ---------- | ----- | ----------------------------------------------- |
| 2023-08-20 | 3.700 | Acquisition (contract) date                     |
| 2023-08-27 | 3.680 | Payment of the cash part                        |
| 2024-04-14 | 3.650 | The supplier's credit note and the refund wired |

### 1.2 Entities and accounts

| Key                        | Kind                     | Notes                                                      |
| -------------------------- | ------------------------ | ---------------------------------------------------------- |
| `seller`                   | Business                 | Seller of the activity ("Acme Ventures Ltd.")              |
| `refund-supplier`          | Business                 | The refunding supplier ("Globex Services Inc.")            |
| `bank-usd`                 | Bank account (USD)       | The buyer's USD account                                    |
| `software`                 | Asset (cost)             | Depreciable, R&D                                           |
| `customer-relations`       | Asset (cost)             | Depreciable, G&A                                           |
| `goodwill`                 | Asset (cost)             | Depreciable, G&A                                           |
| `trademarks`               | Asset (cost)             | **Not** depreciated (a 0% depreciation category)           |
| `acquired-receivables`     | Asset                    | Trade receivables bought with the activity                 |
| `assumed-liabilities`      | Liability                | Seller liabilities taken over by the buyer                 |
| `accumulated-depreciation` | Accumulated depreciation | One account for all assets                                 |
| `depr-rnd` / `depr-gna`    | Expense                  | Depreciation expense, by the asset's type (R&D / G&A)      |
| `depreciation-correction`  | Income (ordinary)        | Recapture of depreciation booked on a refunded cost        |
| `P`                        | Clearing                 | The refund charge's tax category: where the refund is owed |
| `fx-diff`                  | Finance                  | Exchange-rate differences                                  |
| `bank-fees`                | Expense                  | Bank charges                                               |

The admin context points the system's depreciation settings at these accounts: accumulated
depreciation, R&D and G&A (and marketing) depreciation expenses, depreciation correction, exchange
rates and fees.

### 1.3 Depreciation rates

| Asset                  | Annual rate          | Type |
| ---------------------- | -------------------- | ---- |
| Software               | 33%                  | R&D  |
| Customer relationships | 12.5%                | G&A  |
| Goodwill               | 10%                  | G&A  |
| Trademarks and domains | 0% (not depreciated) | G&A  |

### 1.4 Acquisition (2023-08-20)

The total consideration is **USD 480,000**:

- USD 440,000 cash, paid 2023-08-27.
- USD 40,000 of seller liabilities assumed by the buyer.

| Component              | USD         | ILS @ 3.700      |
| ---------------------- | ----------- | ---------------- |
| Software               | 160,000     | 592,000.00       |
| Customer relationships | 200,000     | 740,000.00       |
| Goodwill (residual)    | 60,000      | 222,000.00       |
| Trademarks and domains | 40,000      | 148,000.00       |
| Acquired receivables   | 20,000      | 74,000.00        |
| **Total**              | **480,000** | **1,776,000.00** |

Goodwill is the residual: 480,000 − (160,000 + 200,000 + 40,000 + 20,000) = 60,000.

The acquisition is one charge. It has no documents. The allocation is entered as misc expenses
against `seller`, dated 2023-08-20, and so are the assumed liabilities. The charge also carries the
four asset records, in USD, activated on 2023-08-20, and the payment. The assets are converted at
the rate of their activation date, 3.700 (the contract date), not at the payment's rate. Since the
four assets were bought on one charge, each record names its own cost account (its asset tax
category: the account its misc expense debits), which the cost reductions of §4.4 credit.

Depreciation starts on the acquisition date, 2023-08-20.

Bank transaction: −USD 440,000 from `bank-usd` to `seller` on 2023-08-27, on the acquisition charge.

### 1.5 Supplier refund (2024-04-14)

The refund is one charge, whose tax category is `P`:

- A credit note from `refund-supplier` for USD 100,000, dated 2024-04-14.
- Bank transaction: +USD 99,980 into `bank-usd` from `refund-supplier` on 2024-04-14. This is the
  USD 100,000 refund minus a USD 20 SWIFT fee.
- The USD 20 fee, as a misc expense (Dr `bank-fees` / Cr `refund-supplier`).
- Four cost refunds, entered in USD on the refund charge, from activation (the default mode):
  goodwill 60,000, software 16,000, customer relationships 20,000, trademarks 4,000.

### 1.6 Policy decisions the test encodes

1. **The refund belongs to the acquisition.** The right to the refund existed on the acquisition
   date. It is an acquired asset that the PPA missed, so it reduces the cost of the intangibles. It
   is a cost correction, not a sale: there are no proceeds and no capital gain.
2. **Allocation order.** The refund first eliminates goodwill, which is the residual. The remainder
   is spread over the identifiable intangibles (software, customer relationships, trademarks) in
   proportion to their original USD cost. Receivables are not touched. The user enters the allocated
   amounts.
3. **Conversion rate.** The cost reductions are converted at the acquisition-date rate (3.700), the
   assets' cost-basis rate. The gap to the refund-date rate is an FX difference on the refund
   receivable.
4. **The SWIFT fee is a bank expense.** The cost is reduced by the gross USD 100,000.
5. **2023 is filed and stays as filed.** The excess 2023 depreciation is recaptured as ordinary
   income in 2024, booked on the refund date. From 2024 on, depreciation is computed on the
   corrected cost as if it had been the cost from day one.

---

## 2. Calculation rules

- **Day count.** In the acquisition year, depreciation is pro-rated by days, counting the
  acquisition day. 2023-08-20 → 2023-12-31 is **134 days out of 365** (2023 is not a leap year).
  Middle years are full years.
- **End date.** Depreciation ends on activation + N years − 1 day, N = 100 ÷ rate: 2031-08-19 for
  12.5% from 2023-08-20. For a fractional N, whole years by calendar plus round(fraction × 365)
  days, minus 1: 2026-08-30 for 33%.
- **Final year.** The final year takes the remaining balance.
- **Rounding.** Depreciation is in whole shekels, separately for each asset and each year. The
  recapture is the difference between amounts that are already rounded. Ledger amounts converted
  from a foreign currency are in agorot.

---

## 3. Expected calculations

### 3.1 Refund allocation (USD, then ILS @ 3.700)

| Asset                  | Original USD | Reduction USD | Corrected USD | Reduction ILS  | Corrected ILS    |
| ---------------------- | ------------ | ------------- | ------------- | -------------- | ---------------- |
| Goodwill               | 60,000       | 60,000        | 0             | 222,000.00     | 0.00             |
| Software               | 160,000      | 16,000        | 144,000       | 59,200.00      | 532,800.00       |
| Customer relationships | 200,000      | 20,000        | 180,000       | 74,000.00      | 666,000.00       |
| Trademarks and domains | 40,000       | 4,000         | 36,000        | 14,800.00      | 133,200.00       |
| Acquired receivables   | 20,000       | 0             | 20,000        | 0.00           | 74,000.00        |
| Refund receivable      | —            | —             | 100,000       | —              | 370,000.00       |
| **Total**              | **480,000**  | **100,000**   | **480,000**   | **370,000.00** | **1,776,000.00** |

After goodwill, USD 40,000 is left to allocate. It is split 80 : 100 : 20 out of 200 between
software, customer relationships and trademarks, which gives 16,000 / 20,000 / 4,000.

### 3.2 2023 depreciation as filed (original cost, 134/365)

| Asset                  | Cost ILS   | Annual     | 2023        |
| ---------------------- | ---------- | ---------- | ----------- |
| Software               | 592,000.00 | 195,360.00 | 71,721      |
| Customer relationships | 740,000.00 | 92,500.00  | 33,959      |
| Goodwill               | 222,000.00 | 22,200.00  | 8,150       |
| **Total**              |            | 310,060.00 | **113,830** |

By type: R&D 71,721 (software); G&A 42,109 (customer relationships and goodwill).

### 3.3 2023 depreciation recomputed on the corrected cost, and the excess

| Asset                  | Corrected cost | Annual     | 2023 corrected | 2023 as filed | Excess     |
| ---------------------- | -------------- | ---------- | -------------- | ------------- | ---------- |
| Software               | 532,800.00     | 175,824.00 | 64,549         | 71,721        | 7,172      |
| Customer relationships | 666,000.00     | 83,250.00  | 30,563         | 33,959        | 3,396      |
| Goodwill               | 0.00           | 0.00       | 0              | 8,150         | 8,150      |
| **Total**              |                |            | 95,112         | 113,830       | **18,718** |

The excess is recaptured as income in 2024. Trademarks are not depreciated, so their recapture is 0.

### 3.4 2024 depreciation (full year, corrected cost)

| Asset                  | 2024        |
| ---------------------- | ----------- |
| Software               | 175,824     |
| Customer relationships | 83,250      |
| Goodwill               | 0           |
| **Total**              | **259,074** |

By type: R&D 175,824; G&A 83,250. Goodwill has no cost left and no 2024 depreciation.

### 3.5 Refund FX and fee (@ 3.650)

| Item                                            | ILS            |
| ----------------------------------------------- | -------------- |
| Net received: 99,980 × 3.650                    | 364,927.00     |
| SWIFT fee: 20 × 3.650                           | 73.00          |
| FX loss: 100,000 × (3.700 − 3.650)              | 5,000.00       |
| **Total = refund receivable (100,000 × 3.700)** | **370,000.00** |

The credit note is 100,000 × 3.650 = 365,000.00. In USD, the refunds (100,000) match what the credit
note credits to `P`. In ILS, the cost reductions (370,000.00) exceed it by the FX loss.

### 3.6 Payment FX (2023)

FX gain on the payment to the seller: 440,000 × (3.700 − 3.680) = **8,800.00**.

### 3.7 Asset register at 2024-12-31

| Asset                  | Cost       | Accumulated depreciation | Net book value |
| ---------------------- | ---------- | ------------------------ | -------------- |
| Software               | 532,800.00 | 240,373                  | 292,427        |
| Customer relationships | 666,000.00 | 113,813                  | 552,187        |
| Goodwill               | 0.00       | 0                        | 0              |
| Trademarks and domains | 133,200.00 | — (not depreciated)      | 133,200        |

Accumulated depreciation is built up as follows:

- Software: 71,721 − 7,172 + 175,824 = 240,373.
- Customer relationships: 33,959 − 3,396 + 83,250 = 113,813.
- Goodwill: 8,150 − 8,150 = 0.

In total: 113,830 − 18,718 + 259,074 = 354,186, the balance of the accumulated-depreciation account.

### 3.8 Full schedule on the corrected cost

| Year                        | Software                       | Customer relationships                       |
| --------------------------- | ------------------------------ | -------------------------------------------- |
| 2023                        | 71,721 (as filed)              | 33,959 (as filed)                            |
| 2024                        | 175,824 (+ recapture of 7,172) | 83,250 (+ recapture of 3,396)                |
| 2025                        | 175,824                        | 83,250                                       |
| 2026                        | 116,603 (final, through 08-30) | 83,250                                       |
| 2027–2030                   | —                              | 83,250 each                                  |
| 2031                        | —                              | 52,687 (final, through 2031-08-19 = 231/365) |
| **Total, net of recapture** | **532,800**                    | **666,000**                                  |

Goodwill is closed from 2025 on: it has no cost and no depreciation, and it leaves the depreciation
report.

---

## 4. Expected ledger records

Amounts are in ILS. Each row is one debit/credit pair with equal amounts, except the yearly
depreciation charges, which book each aggregate side as its own entry. Each table is a charge.

### 4.1 Acquisition: invoice date 2023-08-20, value date 2023-08-20

| #   | Debit                  | Credit                | ILS        | USD     | Notes               |
| --- | ---------------------- | --------------------- | ---------- | ------- | ------------------- |
| A1  | `software`             | `seller`              | 592,000.00 | 160,000 | @ 3.700             |
| A2  | `customer-relations`   | `seller`              | 740,000.00 | 200,000 | @ 3.700             |
| A3  | `goodwill`             | `seller`              | 222,000.00 | 60,000  | @ 3.700             |
| A4  | `trademarks`           | `seller`              | 148,000.00 | 40,000  | @ 3.700             |
| A5  | `acquired-receivables` | `seller`              | 74,000.00  | 20,000  | @ 3.700             |
| A6  | `seller`               | `assumed-liabilities` | 148,000.00 | 40,000  | Liabilities assumed |

After the acquisition, `seller` has a credit balance of 1,628,000.00 (USD 440,000).

### 4.2 Payment: invoice date 2023-08-27, value date 2023-08-27 (same charge)

| #   | Debit    | Credit     | ILS          | USD     | Notes                    |
| --- | -------- | ---------- | ------------ | ------- | ------------------------ |
| P1  | `seller` | `bank-usd` | 1,619,200.00 | 440,000 | @ 3.680                  |
| P2  | `seller` | `fx-diff`  | 8,800.00     | —       | FX gain, 440,000 × 0.020 |

After the payment, `seller` has a balance of 0. The charge is balanced.

### 4.3 Depreciation 2023 (as filed): invoice date 2023-12-31, value date 2023-12-31

| #   | Debit      | Credit                     | ILS     |
| --- | ---------- | -------------------------- | ------- |
| D1  | `depr-rnd` |                            | 71,721  |
| D2  | `depr-gna` |                            | 42,109  |
| D3  |            | `accumulated-depreciation` | 113,830 |

The per-asset split (71,721 / 33,959 / 8,150) is the depreciation report's. The charge is the same
before and after the refunds are entered.

### 4.4 Refund: invoice date 2024-04-14, value date 2024-04-14 (every row)

| #   | Debit                      | Credit                    | ILS        | USD      | Notes                                       |
| --- | -------------------------- | ------------------------- | ---------- | -------- | ------------------------------------------- |
| R0  | `refund-supplier`          | `P`                       | 365,000.00 | 100,000  | Credit note @ 3.650                         |
| R1  | `P`                        | `software`                | 59,200.00  | 16,000   | Cost reduction @ 3.700                      |
| R2  | `P`                        | `customer-relations`      | 74,000.00  | 20,000   | Cost reduction @ 3.700                      |
| R3  | `P`                        | `goodwill`                | 222,000.00 | 60,000   | Goodwill eliminated @ 3.700                 |
| R4  | `P`                        | `trademarks`              | 14,800.00  | 4,000    | Cost reduction, not depreciated             |
| R5  | `bank-usd`                 | `refund-supplier`         | 364,927.00 | 99,980   | @ 3.650                                     |
| R6  | `bank-fees`                | `refund-supplier`         | 73.00      | 20       | SWIFT @ 3.650                               |
| R7  | `fx-diff`                  | `P`                       | 5,000.00   | —        | FX loss, 100,000 × 0.050                    |
| R8  | `accumulated-depreciation` | `depreciation-correction` | 7,172      | 1,938.38 | Software: depreciation correction for 2023  |
| R9  | `accumulated-depreciation` | `depreciation-correction` | 3,396      | 917.84   | Customer relationships: correction for 2023 |
| R10 | `accumulated-depreciation` | `depreciation-correction` | 8,150      | 2,202.70 | Goodwill: all 2023 depreciation reversed    |

The refund's cost-reduction and recapture rows (R1–R4, R8–R10) are booked in the assets' currency at
their cost-basis rate (3.700), so the historical rate is the basis of the conversion even though the
rows are dated in 2024. A cost-reduction row carries the refunded USD amount; a recapture row
carries its ILS amount ÷ 3.700, in cents. The FX row (R7) is ILS only. Trademarks have no recapture
row (0).

`refund-supplier` is debited 365,000.00 (R0) and credited 365,000.00 (R5, R6), so its balance is 0.
`P` is credited 370,000.00 (R0, R7) and debited 370,000.00 (R1 to R4), so its balance is 0. The
charge is balanced.

### 4.5 Depreciation 2024: invoice date 2024-12-31, value date 2024-12-31

| #   | Debit      | Credit                     | ILS     |
| --- | ---------- | -------------------------- | ------- |
| D4  | `depr-rnd` |                            | 175,824 |
| D5  | `depr-gna` |                            | 83,250  |
| D6  |            | `accumulated-depreciation` | 259,074 |

No goodwill depreciation (cost is 0).

---

## 5. Expected balances at 2024-12-31 (cumulative)

| Account                    | Debit           | Credit          |
| -------------------------- | --------------- | --------------- |
| `software`                 | 532,800.00      |                 |
| `customer-relations`       | 666,000.00      |                 |
| `goodwill`                 | 0.00            | 0.00            |
| `trademarks`               | 133,200.00      |                 |
| `acquired-receivables`     | 74,000.00       |                 |
| `accumulated-depreciation` |                 | 354,186         |
| `seller`                   | 0.00            | 0.00            |
| `refund-supplier`          | 0.00            | 0.00            |
| `P`                        | 0.00            | 0.00            |
| `assumed-liabilities`      |                 | 148,000.00      |
| `bank-usd`                 |                 | 1,254,273.00    |
| `fx-diff`                  | 5,000.00 (2024) | 8,800.00 (2023) |
| `bank-fees`                | 73.00           |                 |
| `depr-*` (2023)            | 113,830         |                 |
| `depr-*` (2024)            | 259,074         |                 |
| `depreciation-correction`  |                 | 18,718          |
| **Total**                  | **1,783,977**   | **1,783,977**   |

`bank-usd` reflects only this scenario's movements: −1,619,200.00 + 364,927.00. By type, `depr-rnd`
is 71,721 (2023) and 175,824 (2024); `depr-gna` is 42,109 (2023) and 83,250 (2024).

### Profit and loss per year

| Year | Items                                                                            | Net      |
| ---- | -------------------------------------------------------------------------------- | -------- |
| 2023 | Depreciation −113,830; FX gain +8,800                                            | −105,030 |
| 2024 | Depreciation −259,074; depreciation correction +18,718; FX loss −5,000; fees −73 | −245,429 |

---

## 6. Assertions checklist

All exact: depreciation in whole shekels, converted amounts in agorot.

1. **Allocation (§3.1).** The refunds convert at the cost-basis rate 3.700 to 222,000 / 59,200 /
   74,000 / 14,800, leaving software 532,800, customer relationships 666,000, goodwill 0 and
   trademarks 133,200.
2. **2023 unchanged (§3.2).** The 2023 depreciation charge and the 2023 depreciation report are the
   same before and after the refunds are entered: software 71,721, customer relationships 33,959,
   goodwill 8,150; R&D 71,721 and G&A 42,109.
3. **Recapture and 2024 (§3.3, §3.4).** The recapture is 7,172 / 3,396 / 8,150 = 18,718. 2024
   depreciation is software 175,824 (R&D) and customer relationships 83,250 (G&A), with no goodwill
   depreciation. The 2024 report shows, per asset, the opening cost, the refunded cost and the
   closing cost, and the opening accumulated depreciation, the correction, the year's depreciation
   and the closing accumulated depreciation: 240,373 / 113,813 / 0.
4. **Ledger (§4).** The records of each charge match §4: accounts, ILS and USD amounts, invoice and
   value dates. Every charge is balanced.
5. **Balances (§5).** The balances at 2024-12-31 match §5, 1,783,977 on each side. `seller`,
   `refund-supplier`, `P` and `goodwill` are all 0. Profit and loss: 2023 −105,030; 2024 −245,429.
6. **Not in the report.** Trademarks (0%) and acquired receivables never appear in the 2023 or 2024
   depreciation report. Goodwill is absent from the 2025 report.

---

## 7. Out of scope

- **Assumed liabilities.** Settling them. When that happens, the payment reduces the liability: it
  is not an expense, and only its own FX difference hits the P&L.
- **Acquired receivables.** Collecting them.
- **Optional year-end revaluation.** Revaluing the refund receivable at year-end 2023. The refund
  was unknown when 2023 was filed, so the whole FX difference falls in 2024.
- **Deferred by the assessment:** an allocation helper (goodwill first, then pro rata; L3),
  splitting a fee out of a net receipt (L8), accumulated depreciation by asset class (L6), and
  letting the asset records drive the split of a multi-asset purchase in the ledger (P3.3).
