---
'@accounter/server': patch
---

- **SQL Query Modification**: A `WHERE t.id IS NOT NULL` clause has been added to the
  `getTransactionsByBankDeposits` SQL query. This ensures that only deposit charges that have a
  corresponding transaction are included in the results, effectively filtering out charges with no
  associated transactions.
