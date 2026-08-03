---
"@accounter/server": minor
---

Add a `transactionsByFilters` query to the transactions module. It fetches transactions filtered by
transaction ids, charge ids, owners (scoped to the authorized read scope), counterparty ids, date
ranges (event date, debit date, or any date), missing counterparty, missing info (fails transaction
validation), and free text (source description / reference, amount, counter account, origin key, and
counterparty name).
