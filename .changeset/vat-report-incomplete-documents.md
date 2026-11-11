---
'@accounter/server': patch
---

The VAT report no longer fails entirely when one document is missing an amount, currency or date
(#4946).

- Such documents are left out of income/expenses, and their charges are listed under
  `missingInfo`, so the rest of the month still renders.
- Generating the PCN874 file for that month fails with an error that names those documents, rather
  than filing a month that leaves them out.
- Monthly VAT ledger generation reports an error that names them.
- A failed tax adjustment is logged once, not twice.
