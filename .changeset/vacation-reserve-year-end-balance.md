---
'@accounter/server': patch
---

Fix the overstated vacation reserve: it is now the year-end payslip vacation balance × daily wage
per active employee, instead of the sum of every month's balance plus the statutory entitlement. The
ledger entry now books a decrease as Dr reserve / Cr expense, and books nothing when the reserve is
unchanged.
