---
'@accounter/server': patch
'@accounter/client': patch
---

Annual audit workflow: current tax is never negative. In a loss year the tax-expense charge books
no tax entry (it used to book the absolute value of the negative tax as an expense and a liability),
step 4 still finds the ledger-less tax charge, and the tax report shows tax 0 with the taxable loss.
New `TaxReportYear.taxableLoss` and `TaxReportYear.mixedRateLoss` fields; the report warns when
regular-rate and preferred-rate (sort code 991) incomes have opposite signs.
