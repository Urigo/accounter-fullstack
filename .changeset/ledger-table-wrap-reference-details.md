---
'@accounter/client': patch
---

Wrap the Reference and Details columns of the business ledger transactions table (the table shown
when expanding a leaf in the dynamic report, and on the Business Ledger, Trial Balance and business
Balance views) instead of keeping each on one line. Details wraps between words; Reference may break
anywhere. In the dynamic report the expanded table now fits its row, so the horizontal scrollbar is
only needed for unusually wide tables.
