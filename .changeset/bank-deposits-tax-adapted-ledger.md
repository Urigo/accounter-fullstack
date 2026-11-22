---
'@accounter/server': patch
---

Bank deposits: tax-adapted ledger. A deposit is replayed event by event the way the bank treats it:
at every top-up or withdrawal the whole deposit is realized, so the deposit ledger now books the FX
revaluation of the carried principal, the interest the bank capitalized into the deposit (from
Poalim's deposits tax-collection rows, or inferred by accrual weight once the deposit is closed) and
the tax withheld (new `bankDepositWithholdingTaxCategoryId` admin setting). This fixes the
"over-withdrawn" deposits, partial withdrawals failing with "Deposit transaction does not match the
withdrawal transaction", double-counted revaluations of breathing deposits, and the year-end
revaluation summing all currencies (now per deposit). Deposit metadata balance and interest include
capitalized interest; `potentialCloseDate` is set once the deposit is empty; `createDepositFromCharge`
now links the charge with its account.
