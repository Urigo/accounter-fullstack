# Test case spec: asset-deal acquisition followed by a cost refund

A business buys the activity of another company for USD. This is an asset deal, not a share
purchase. Part of the price is allocated to depreciable intangibles.

In the next tax year, a supplier refunds an amount that the acquired business was already owed on
the acquisition date. The purchase-price allocation (PPA) missed this amount, so the refund lowers
the cost of the acquired intangibles. The acquisition year is already filed, so the correction is
booked in the year of the refund.

All names, dates, amounts, exchange rates and allocation shares here are fictional. The spec lists
inputs and expected outputs only. It does not assume how the code computes them.

---

## 1. Inputs

### 1.1 Exchange rates (USD → ILS)

| Date       | Rate  | Used for                       |
| ---------- | ----- | ------------------------------ |
| 2023-08-20 | 3.700 | Acquisition (contract) date    |
| 2023-08-27 | 3.680 | Payment of the cash part       |
| 2024-04-14 | 3.650 | Receipt of the supplier refund |

### 1.2 Entities and accounts

| Key                                                              | Kind                     | Notes                                           |
| ---------------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| `seller`                                                         | Business                 | Seller of the activity ("Acme Ventures Ltd.")   |
| `refund-supplier`                                                | Business                 | The refunding supplier ("Globex Services Inc.") |
| `bank-usd`                                                       | Bank account (USD)       | The buyer's USD account                         |
| `software`                                                       | Asset (cost)             | Depreciable                                     |
| `customer-relations`                                             | Asset (cost)             | Depreciable                                     |
| `goodwill`                                                       | Asset (cost)             | Depreciable                                     |
| `trademarks`                                                     | Asset (cost)             | **Not** depreciated                             |
| `acquired-receivables`                                           | Asset                    | Trade receivables bought with the activity      |
| `assumed-liabilities`                                            | Liability                | Seller liabilities taken over by the buyer      |
| `accum-software` / `accum-customer-relations` / `accum-goodwill` | Accumulated depreciation | One per depreciable asset                       |
| `depr-software` / `depr-customer-relations` / `depr-goodwill`    | Expense                  | Depreciation expense, one per asset             |
| `prior-year-depr-correction`                                     | Income                   | Recapture of excess prior-year depreciation     |
| `fx-diff`                                                        | Finance                  | Exchange-rate differences                       |
| `bank-fees`                                                      | Expense                  | Bank charges                                    |

### 1.3 Depreciation rates

| Asset                  | Annual rate     |
| ---------------------- | --------------- |
| Software               | 33%             |
| Customer relationships | 12.5%           |
| Goodwill               | 10%             |
| Trademarks and domains | not depreciated |

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

Depreciation starts on the acquisition date, 2023-08-20.

Bank transaction: −USD 440,000 from `bank-usd` to `seller` on 2023-08-27.

### 1.5 Supplier refund (2024-04-14)

Bank transaction: +USD 99,980 into `bank-usd` from `refund-supplier` on 2024-04-14. This is a USD
100,000 refund minus a USD 20 SWIFT fee.

### 1.6 Policy decisions the test encodes

1. **The refund belongs to the acquisition.** The right to the refund existed on the acquisition
   date. It is an acquired asset that the PPA missed, so it reduces the cost of the intangibles.
2. **Allocation order.** The refund first eliminates goodwill, which is the residual. The remainder
   is spread over the identifiable intangibles (software, customer relationships, trademarks) in
   proportion to their original USD cost. Receivables are not touched.
3. **Conversion rate.** The cost reductions are converted at the acquisition-date rate (3.700). The
   gap to the refund-date rate is an FX difference on the refund receivable.
4. **The SWIFT fee is a bank expense.** The cost is reduced by the gross USD 100,000.
5. **2023 is filed and stays as filed.** The excess 2023 depreciation is recaptured as income
   in 2024. From 2024 on, depreciation is computed on the corrected cost as if it had been the cost
   from day one.

---

## 2. Calculation rules

- **Day count.** In the acquisition year, depreciation is pro-rated by days, counting the
  acquisition day. 2023-08-20 → 2023-12-31 is **134 days out of 365** (2023 is not a leap year).
  Middle years are full years.
- **Final year.** The final year takes the remaining balance.
- **Rounding.** ILS amounts are rounded to 2 decimals (half-up), separately for each asset and each
  year. Any difference (for example, the excess depreciation) is taken between amounts that are
  already rounded.

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

| Asset                  | Cost ILS   | Annual     | 2023           |
| ---------------------- | ---------- | ---------- | -------------- |
| Software               | 592,000.00 | 195,360.00 | 71,721.21      |
| Customer relationships | 740,000.00 | 92,500.00  | 33,958.90      |
| Goodwill               | 222,000.00 | 22,200.00  | 8,150.14       |
| **Total**              |            | 310,060.00 | **113,830.25** |

### 3.3 2023 depreciation recomputed on the corrected cost, and the excess

| Asset                  | Corrected cost | Annual     | 2023 corrected | 2023 as filed | Excess        |
| ---------------------- | -------------- | ---------- | -------------- | ------------- | ------------- |
| Software               | 532,800.00     | 175,824.00 | 64,549.08      | 71,721.21     | 7,172.13      |
| Customer relationships | 666,000.00     | 83,250.00  | 30,563.01      | 33,958.90     | 3,395.89      |
| Goodwill               | 0.00           | 0.00       | 0.00           | 8,150.14      | 8,150.14      |
| **Total**              |                |            | 95,112.09      | 113,830.25    | **18,718.16** |

The excess is recaptured as income in 2024.

### 3.4 2024 depreciation (full year, corrected cost)

| Asset                  | 2024           |
| ---------------------- | -------------- |
| Software               | 175,824.00     |
| Customer relationships | 83,250.00      |
| Goodwill               | 0.00           |
| **Total**              | **259,074.00** |

### 3.5 Refund FX and fee (@ 3.650)

| Item                                            | ILS            |
| ----------------------------------------------- | -------------- |
| Net received: 99,980 × 3.650                    | 364,927.00     |
| SWIFT fee: 20 × 3.650                           | 73.00          |
| FX loss: 100,000 × (3.700 − 3.650)              | 5,000.00       |
| **Total = refund receivable (100,000 × 3.700)** | **370,000.00** |

### 3.6 Payment FX (2023)

FX gain on the payment to the seller: 440,000 × (3.700 − 3.680) = **8,800.00**.

### 3.7 Asset register at 2024-12-31

| Asset                  | Cost       | Accumulated depreciation | Net book value |
| ---------------------- | ---------- | ------------------------ | -------------- |
| Software               | 532,800.00 | 240,373.08               | 292,426.92     |
| Customer relationships | 666,000.00 | 113,813.01               | 552,186.99     |
| Goodwill               | 0.00       | 0.00                     | 0.00           |
| Trademarks and domains | 133,200.00 | — (not depreciated)      | 133,200.00     |

Accumulated depreciation is built up as follows:

- Software: 71,721.21 − 7,172.13 + 175,824.00 = 240,373.08.
- Customer relationships: 33,958.90 − 3,395.89 + 83,250.00 = 113,813.01.
- Goodwill: 8,150.14 − 8,150.14 = 0.

### 3.8 Full schedule on the corrected cost (optional assertions)

| Year                        | Software                             | Customer relationships                          |
| --------------------------- | ------------------------------------ | ----------------------------------------------- |
| 2023                        | 71,721.21 (as filed)                 | 33,958.90 (as filed)                            |
| 2024                        | 175,824.00 (+ recapture of 7,172.13) | 83,250.00 (+ recapture of 3,395.89)             |
| 2025                        | 175,824.00                           | 83,250.00                                       |
| 2026                        | 116,602.92 (final)                   | 83,250.00                                       |
| 2027–2030                   | —                                    | 83,250.00 each                                  |
| 2031                        | —                                    | 52,686.99 (final, through 2031-08-19 = 231/365) |
| **Total, net of recapture** | **532,800.00**                       | **666,000.00**                                  |

---

## 4. Expected ledger records

Amounts are in ILS. Each row is one debit/credit pair with equal amounts. Each table is a charge or
event.

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

### 4.2 Payment: invoice date 2023-08-27, value date 2023-08-27

| #   | Debit    | Credit     | ILS          | USD     | Notes                    |
| --- | -------- | ---------- | ------------ | ------- | ------------------------ |
| P1  | `seller` | `bank-usd` | 1,619,200.00 | 440,000 | @ 3.680                  |
| P2  | `seller` | `fx-diff`  | 8,800.00     | —       | FX gain, 440,000 × 0.020 |

After the payment, `seller` has a balance of 0.

### 4.3 Depreciation 2023 (as filed): invoice date 2023-12-31, value date 2023-12-31

| #   | Debit                     | Credit                     | ILS       |
| --- | ------------------------- | -------------------------- | --------- |
| D1  | `depr-software`           | `accum-software`           | 71,721.21 |
| D2  | `depr-customer-relations` | `accum-customer-relations` | 33,958.90 |
| D3  | `depr-goodwill`           | `accum-goodwill`           | 8,150.14  |

### 4.4 Refund: invoice date 2024-04-14

| #   | Debit                      | Credit                       | ILS        | USD    | Value date | Notes                                   |
| --- | -------------------------- | ---------------------------- | ---------- | ------ | ---------- | --------------------------------------- |
| R1  | `refund-supplier`          | `software`                   | 59,200.00  | 16,000 | 2023-08-20 | Cost reduction @ 3.700                  |
| R2  | `refund-supplier`          | `customer-relations`         | 74,000.00  | 20,000 | 2023-08-20 | Cost reduction @ 3.700                  |
| R3  | `refund-supplier`          | `goodwill`                   | 222,000.00 | 60,000 | 2023-08-20 | Goodwill eliminated                     |
| R4  | `refund-supplier`          | `trademarks`                 | 14,800.00  | 4,000  | 2023-08-20 | Cost reduction, not depreciated         |
| R5  | `bank-usd`                 | `refund-supplier`            | 364,927.00 | 99,980 | 2024-04-14 | @ 3.650                                 |
| R6  | `bank-fees`                | `refund-supplier`            | 73.00      | 20     | 2024-04-14 | SWIFT @ 3.650                           |
| R7  | `fx-diff`                  | `refund-supplier`            | 5,000.00   | —      | 2024-04-14 | FX loss, 100,000 × 0.050                |
| R8  | `accum-software`           | `prior-year-depr-correction` | 7,172.13   | —      | 2023-12-31 | Excess 2023 depreciation                |
| R9  | `accum-customer-relations` | `prior-year-depr-correction` | 3,395.89   | —      | 2023-12-31 | Excess 2023 depreciation                |
| R10 | `accum-goodwill`           | `prior-year-depr-correction` | 8,150.14   | —      | 2023-12-31 | All 2023 goodwill depreciation reversed |

`refund-supplier` is debited 370,000.00 (R1 to R4) and credited 370,000.00 (R5 to R7), so its
balance is 0.

### 4.5 Depreciation 2024: invoice date 2024-12-31, value date 2024-12-31

| #   | Debit                     | Credit                     | ILS        |
| --- | ------------------------- | -------------------------- | ---------- |
| D4  | `depr-software`           | `accum-software`           | 175,824.00 |
| D5  | `depr-customer-relations` | `accum-customer-relations` | 83,250.00  |

No goodwill row (cost is 0).

---

## 5. Expected balances at 2024-12-31 (cumulative)

| Account                      | Debit            | Credit           |
| ---------------------------- | ---------------- | ---------------- |
| `software`                   | 532,800.00       |                  |
| `customer-relations`         | 666,000.00       |                  |
| `goodwill`                   | 0.00             | 0.00             |
| `trademarks`                 | 133,200.00       |                  |
| `acquired-receivables`       | 74,000.00        |                  |
| `accum-software`             |                  | 240,373.08       |
| `accum-customer-relations`   |                  | 113,813.01       |
| `accum-goodwill`             | 0.00             | 0.00             |
| `seller`                     | 0.00             | 0.00             |
| `refund-supplier`            | 0.00             | 0.00             |
| `assumed-liabilities`        |                  | 148,000.00       |
| `bank-usd`                   |                  | 1,254,273.00     |
| `fx-diff`                    | 5,000.00 (2024)  | 8,800.00 (2023)  |
| `bank-fees`                  | 73.00            |                  |
| `depr-*` (2023)              | 113,830.25       |                  |
| `depr-*` (2024)              | 259,074.00       |                  |
| `prior-year-depr-correction` |                  | 18,718.16        |
| **Total**                    | **1,783,977.25** | **1,783,977.25** |

`bank-usd` reflects only this scenario's movements: −1,619,200.00 + 364,927.00.

### Profit and loss per year

| Year | Items                                                                                      | Net         |
| ---- | ------------------------------------------------------------------------------------------ | ----------- |
| 2023 | Depreciation −113,830.25; FX gain +8,800.00                                                | −105,030.25 |
| 2024 | Depreciation −259,074.00; prior-year correction +18,718.16; FX loss −5,000.00; fees −73.00 | −245,428.84 |

---

## 6. Assertions checklist

1. The refund allocation matches §3.1.
2. 2023 depreciation matches §3.2 and does not change after the refund is entered.
3. The excess and the 2024 depreciation match §3.3 and §3.4.
4. The ledger records of each charge match §4: accounts, amounts, USD amounts, invoice and value
   dates. Every charge is balanced.
5. The balances at 2024-12-31 match §5. `seller`, `refund-supplier`, `goodwill` and `accum-goodwill`
   are all 0.
6. Trademarks and acquired receivables never appear in the depreciation report.

## 7. Out of scope

- **Assumed liabilities.** Settling them. When that happens, the payment reduces the liability: it
  is not an expense, and only its own FX difference hits the P&L.
- **Acquired receivables.** Collecting them.
- **Optional year-end revaluation.** Revaluing the refund receivable at year-end 2023. The refund
  was unknown when 2023 was filed, so the whole FX difference falls in 2024.
