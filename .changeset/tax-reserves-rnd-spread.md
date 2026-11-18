---
'@accounter/server': patch
---

From tax year 2025, reserve expenses (sort code 931) are adjusted for tax exactly once: added back in
the year they are recognised (6111 line 150) and kept out of the section 20A R&D add-back and
three-year spread. Earlier years keep the treatment they were filed with, including their share of
the spread. The tax report, the tax-expense charge and 6111 now share one computation
(`calculateYearTax`). The P&L still presents 931 under R&D.
