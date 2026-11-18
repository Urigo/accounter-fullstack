---
'@accounter/server': patch
---

Fix the overstated vacation reserve. The reserve at year-end is now, summed over employees still
employed at year-end, the vacation days balance on the year's latest payslip × the daily wage. It no
longer sums every month's running balance, adds the statutory seniority entitlement on top, or
applies part-time twice: part-time is applied once, in the daily wage (hourly employees use their
average monthly hours in the year). A missing year-end balance is an error that lists the employees.

The vacation-reserve ledger entry now books the change by its sign, like the recovery reserve: an
increase is Dr expense / Cr reserve, a decrease is Dr reserve / Cr expense, and no change produces no
entry. Regenerate existing vacation-reserve charges to pick up the corrected amount.
