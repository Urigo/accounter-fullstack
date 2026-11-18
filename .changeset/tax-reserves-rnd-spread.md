---
'@accounter/server': patch
---

Reserve expenses (sort code 931) are now adjusted for tax exactly once: added back in the year they
are recognised (6111 line 150) and kept out of the section 20A R&D add-back and three-year spread.
This applies to the tax report, the tax-expense charge and 6111. The P&L still presents 931 under
R&D.
