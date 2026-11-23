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
| 2024-08-20 | 3.700 | Acquisition (contract) date    |
| 2024-08-27 | 3.680 | Payment of the cash part       |
| 2025-04-14 | 3.650 | Receipt of the supplier refund |

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

### 1.4 Acquisition (2024-08-20)

The total consideration is **USD 240,000**:

- USD 220,000 cash, paid 2024-08-27.
- USD 20,000 of seller liabilities assumed by the buyer.

| Component              | USD         | ILS @ 3.700    |
| ---------------------- | ----------- | -------------- |
| Software               | 80,000      | 296,000.00     |
| Customer relationships | 100,000     | 370,000.00     |
| Goodwill (residual)    | 30,000      | 111,000.00     |
| Trademarks and domains | 20,000      | 74,000.00      |
| Acquired receivables   | 10,000      | 37,000.00      |
| **Total**              | **240,000** | **888,000.00** |

Goodwill is the residual: 240,000 − (80,000 + 100,000 + 20,000 + 10,000) = 30,000.

Depreciation starts on the acquisition date, 2024-08-20.

Bank transaction: −USD 220,000 from `bank-usd` to `seller` on 2024-08-27.

### 1.5 Supplier refund (2025-04-14)

Bank transaction: +USD 49,990 into `bank-usd` from `refund-supplier` on 2025-04-14. This is a USD
50,000 refund minus a USD 10 SWIFT fee.

### 1.6 Policy decisions the test encodes

1. **The refund belongs to the acquisition.** The right to the refund existed on the acquisition
   date. It is an acquired asset that the PPA missed, so it reduces the cost of the intangibles.
2. **Allocation order.** The refund first eliminates goodwill, which is the residual. The remainder
   is spread over the identifiable intangibles (software, customer relationships, trademarks) in
   proportion to their original USD cost. Receivables are not touched.
3. **Conversion rate.** The cost reductions are converted at the acquisition-date rate (3.700). The
   gap to the refund-date rate is an FX difference on the refund receivable.
4. **The SWIFT fee is a bank expense.** The cost is reduced by the gross USD 50,000.
5. **2024 is filed and stays as filed.** The excess 2024 depreciation is recaptured as income
   in 2025. From 2025 on, depreciation is computed on the corrected cost as if it had been the cost
   from day one.

---

## 2. Calculation rules

- **Day count.** In the acquisition year, depreciation is pro-rated by days, counting the
  acquisition day. 2024-08-20 → 2024-12-31 is **134 days out of 366** (2024 is a leap year). Middle
  years are full years.
- **Final year.** The final year takes the remaining balance.
- **Rounding.** ILS amounts are rounded to 2 decimals (half-up), separately for each asset and each
  year. Any difference (for example, the excess depreciation) is taken between amounts that are
  already rounded.

---

## 3. Expected calculations

### 3.1 Refund allocation (USD, then ILS @ 3.700)

| Asset                  | Original USD | Reduction USD | Corrected USD | Reduction ILS  | Corrected ILS  |
| ---------------------- | ------------ | ------------- | ------------- | -------------- | -------------- |
| Goodwill               | 30,000       | 30,000        | 0             | 111,000.00     | 0.00           |
| Software               | 80,000       | 8,000         | 72,000        | 29,600.00      | 266,400.00     |
| Customer relationships | 100,000      | 10,000        | 90,000        | 37,000.00      | 333,000.00     |
| Trademarks and domains | 20,000       | 2,000         | 18,000        | 7,400.00       | 66,600.00      |
| Acquired receivables   | 10,000       | 0             | 10,000        | 0.00           | 37,000.00      |
| Refund receivable      | —            | —             | 50,000        | —              | 185,000.00     |
| **Total**              | **240,000**  | **50,000**    | **240,000**   | **185,000.00** | **888,000.00** |

After goodwill, USD 20,000 is left to allocate. It is split 80 : 100 : 20 out of 200 between
software, customer relationships and trademarks, which gives 8,000 / 10,000 / 2,000.

### 3.2 2024 depreciation as filed (original cost, 134/366)

| Asset                  | Cost ILS   | Annual     | 2024          |
| ---------------------- | ---------- | ---------- | ------------- |
| Software               | 296,000.00 | 97,680.00  | 35,762.62     |
| Customer relationships | 370,000.00 | 46,250.00  | 16,933.06     |
| Goodwill               | 111,000.00 | 11,100.00  | 4,063.93      |
| **Total**              |            | 155,030.00 | **56,759.61** |

### 3.3 2024 depreciation recomputed on the corrected cost, and the excess

| Asset                  | Corrected cost | Annual    | 2024 corrected | 2024 as filed | Excess       |
| ---------------------- | -------------- | --------- | -------------- | ------------- | ------------ |
| Software               | 266,400.00     | 87,912.00 | 32,186.36      | 35,762.62     | 3,576.26     |
| Customer relationships | 333,000.00     | 41,625.00 | 15,239.75      | 16,933.06     | 1,693.31     |
| Goodwill               | 0.00           | 0.00      | 0.00           | 4,063.93      | 4,063.93     |
| **Total**              |                |           | 47,426.11      | 56,759.61     | **9,333.50** |

The excess is recaptured as income in 2025.

### 3.4 2025 depreciation (full year, corrected cost)

| Asset                  | 2025           |
| ---------------------- | -------------- |
| Software               | 87,912.00      |
| Customer relationships | 41,625.00      |
| Goodwill               | 0.00           |
| **Total**              | **129,537.00** |

### 3.5 Refund FX and fee (@ 3.650)

| Item                                           | ILS            |
| ---------------------------------------------- | -------------- |
| Net received: 49,990 × 3.650                   | 182,463.50     |
| SWIFT fee: 10 × 3.650                          | 36.50          |
| FX loss: 50,000 × (3.700 − 3.650)              | 2,500.00       |
| **Total = refund receivable (50,000 × 3.700)** | **185,000.00** |

### 3.6 Payment FX (2024)

FX gain on the payment to the seller: 220,000 × (3.700 − 3.680) = **4,400.00**.

### 3.7 Asset register at 2025-12-31

| Asset                  | Cost       | Accumulated depreciation | Net book value |
| ---------------------- | ---------- | ------------------------ | -------------- |
| Software               | 266,400.00 | 120,098.36               | 146,301.64     |
| Customer relationships | 333,000.00 | 56,864.75                | 276,135.25     |
| Goodwill               | 0.00       | 0.00                     | 0.00           |
| Trademarks and domains | 66,600.00  | — (not depreciated)      | 66,600.00      |

Accumulated depreciation is built up as follows:

- Software: 35,762.62 − 3,576.26 + 87,912.00 = 120,098.36.
- Customer relationships: 16,933.06 − 1,693.31 + 41,625.00 = 56,864.75.
- Goodwill: 4,063.93 − 4,063.93 = 0.

### 3.8 Full schedule on the corrected cost (optional assertions)

| Year                        | Software                            | Customer relationships                          |
| --------------------------- | ----------------------------------- | ----------------------------------------------- |
| 2024                        | 35,762.62 (as filed)                | 16,933.06 (as filed)                            |
| 2025                        | 87,912.00 (+ recapture of 3,576.26) | 41,625.00 (+ recapture of 1,693.31)             |
| 2026                        | 87,912.00                           | 41,625.00                                       |
| 2027                        | 58,389.64 (final)                   | 41,625.00                                       |
| 2028–2031                   | —                                   | 41,625.00 each                                  |
| 2032                        | —                                   | 26,385.25 (final, through 2032-08-19 = 232/366) |
| **Total, net of recapture** | **266,400.00**                      | **333,000.00**                                  |

---

## 4. Expected ledger records

Amounts are in ILS. Each row is one debit/credit pair with equal amounts. Each table is a charge or
event.

### 4.1 Acquisition: invoice date 2024-08-20, value date 2024-08-20

| #   | Debit                  | Credit                | ILS        | USD     | Notes               |
| --- | ---------------------- | --------------------- | ---------- | ------- | ------------------- |
| A1  | `software`             | `seller`              | 296,000.00 | 80,000  | @ 3.700             |
| A2  | `customer-relations`   | `seller`              | 370,000.00 | 100,000 | @ 3.700             |
| A3  | `goodwill`             | `seller`              | 111,000.00 | 30,000  | @ 3.700             |
| A4  | `trademarks`           | `seller`              | 74,000.00  | 20,000  | @ 3.700             |
| A5  | `acquired-receivables` | `seller`              | 37,000.00  | 10,000  | @ 3.700             |
| A6  | `seller`               | `assumed-liabilities` | 74,000.00  | 20,000  | Liabilities assumed |

After the acquisition, `seller` has a credit balance of 814,000.00 (USD 220,000).

### 4.2 Payment: invoice date 2024-08-27, value date 2024-08-27

| #   | Debit    | Credit     | ILS        | USD     | Notes                    |
| --- | -------- | ---------- | ---------- | ------- | ------------------------ |
| P1  | `seller` | `bank-usd` | 809,600.00 | 220,000 | @ 3.680                  |
| P2  | `seller` | `fx-diff`  | 4,400.00   | —       | FX gain, 220,000 × 0.020 |

After the payment, `seller` has a balance of 0.

### 4.3 Depreciation 2024 (as filed): invoice date 2024-12-31, value date 2024-12-31

| #   | Debit                     | Credit                     | ILS       |
| --- | ------------------------- | -------------------------- | --------- |
| D1  | `depr-software`           | `accum-software`           | 35,762.62 |
| D2  | `depr-customer-relations` | `accum-customer-relations` | 16,933.06 |
| D3  | `depr-goodwill`           | `accum-goodwill`           | 4,063.93  |

### 4.4 Refund: invoice date 2025-04-14

| #   | Debit                      | Credit                       | ILS        | USD    | Value date | Notes                                   |
| --- | -------------------------- | ---------------------------- | ---------- | ------ | ---------- | --------------------------------------- |
| R1  | `refund-supplier`          | `software`                   | 29,600.00  | 8,000  | 2024-08-20 | Cost reduction @ 3.700                  |
| R2  | `refund-supplier`          | `customer-relations`         | 37,000.00  | 10,000 | 2024-08-20 | Cost reduction @ 3.700                  |
| R3  | `refund-supplier`          | `goodwill`                   | 111,000.00 | 30,000 | 2024-08-20 | Goodwill eliminated                     |
| R4  | `refund-supplier`          | `trademarks`                 | 7,400.00   | 2,000  | 2024-08-20 | Cost reduction, not depreciated         |
| R5  | `bank-usd`                 | `refund-supplier`            | 182,463.50 | 49,990 | 2025-04-14 | @ 3.650                                 |
| R6  | `bank-fees`                | `refund-supplier`            | 36.50      | 10     | 2025-04-14 | SWIFT @ 3.650                           |
| R7  | `fx-diff`                  | `refund-supplier`            | 2,500.00   | —      | 2025-04-14 | FX loss, 50,000 × 0.050                 |
| R8  | `accum-software`           | `prior-year-depr-correction` | 3,576.26   | —      | 2024-12-31 | Excess 2024 depreciation                |
| R9  | `accum-customer-relations` | `prior-year-depr-correction` | 1,693.31   | —      | 2024-12-31 | Excess 2024 depreciation                |
| R10 | `accum-goodwill`           | `prior-year-depr-correction` | 4,063.93   | —      | 2024-12-31 | All 2024 goodwill depreciation reversed |

`refund-supplier` is debited 185,000.00 (R1 to R4) and credited 185,000.00 (R5 to R7), so its
balance is 0.

### 4.5 Depreciation 2025: invoice date 2025-12-31, value date 2025-12-31

| #   | Debit                     | Credit                     | ILS       |
| --- | ------------------------- | -------------------------- | --------- |
| D4  | `depr-software`           | `accum-software`           | 87,912.00 |
| D5  | `depr-customer-relations` | `accum-customer-relations` | 41,625.00 |

No goodwill row (cost is 0).

---

## 5. Expected balances at 2025-12-31 (cumulative)

| Account                      | Debit           | Credit          |
| ---------------------------- | --------------- | --------------- |
| `software`                   | 266,400.00      |                 |
| `customer-relations`         | 333,000.00      |                 |
| `goodwill`                   | 0.00            | 0.00            |
| `trademarks`                 | 66,600.00       |                 |
| `acquired-receivables`       | 37,000.00       |                 |
| `accum-software`             |                 | 120,098.36      |
| `accum-customer-relations`   |                 | 56,864.75       |
| `accum-goodwill`             | 0.00            | 0.00            |
| `seller`                     | 0.00            | 0.00            |
| `refund-supplier`            | 0.00            | 0.00            |
| `assumed-liabilities`        |                 | 74,000.00       |
| `bank-usd`                   |                 | 627,136.50      |
| `fx-diff`                    | 2,500.00 (2025) | 4,400.00 (2024) |
| `bank-fees`                  | 36.50           |                 |
| `depr-*` (2024)              | 56,759.61       |                 |
| `depr-*` (2025)              | 129,537.00      |                 |
| `prior-year-depr-correction` |                 | 9,333.50        |
| **Total**                    | **891,833.11**  | **891,833.11**  |

`bank-usd` reflects only this scenario's movements: −809,600.00 + 182,463.50.

### Profit and loss per year

| Year | Items                                                                                     | Net         |
| ---- | ----------------------------------------------------------------------------------------- | ----------- |
| 2024 | Depreciation −56,759.61; FX gain +4,400.00                                                | −52,359.61  |
| 2025 | Depreciation −129,537.00; prior-year correction +9,333.50; FX loss −2,500.00; fees −36.50 | −122,740.00 |

---

## 6. Assertions checklist

1. The refund allocation matches §3.1.
2. 2024 depreciation matches §3.2 and does not change after the refund is entered.
3. The excess and the 2025 depreciation match §3.3 and §3.4.
4. The ledger records of each charge match §4: accounts, amounts, USD amounts, invoice and value
   dates. Every charge is balanced.
5. The balances at 2025-12-31 match §5. `seller`, `refund-supplier`, `goodwill` and `accum-goodwill`
   are all 0.
6. Trademarks and acquired receivables never appear in the depreciation report.

## 7. Out of scope

- **Assumed liabilities.** Settling them. When that happens, the payment reduces the liability: it
  is not an expense, and only its own FX difference hits the P&L.
- **Acquired receivables.** Collecting them.
- **Optional year-end revaluation.** Revaluing the refund receivable at year-end 2024. The refund
  was unknown when 2024 was filed, so the whole FX difference falls in 2025.
