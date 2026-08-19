---
'@accounter/server': minor
---

Rewrite the securities execution↔transaction matcher around what both sources actually report.

`accounter_schema.poalim_securities_transactions` carries no link to `accounter_schema.transactions`
— the scrape has no per-execution id — so the pairing is derived. The first cut derived it loosely: a
±5 day window over four candidate dates on each side, and a ±0.01 tolerance over three candidate
amounts, with signs ignored. That accepted more than it should: any of twelve date pairs and three
amount columns could carry a match, so an execution could attach to a cash movement it had nothing to
do with, in the wrong direction.

The rule is now the two facts both sides report about the same event, and both are exact:

- **`value_date` = the transaction's effective debit date** (`debit_date_override ?? debit_date`).
  The execution settles on the day the account moves; either side missing that date cannot pair.
- **Net value in the transaction's own currency = the amount**, with the sign the trade type
  implies. The comparable column is picked by currency (`trade_currency` → `net_value_trade_currency`,
  `settlement_currency` → `net_value_settlement_currency`, ILS → `net_value_nis`) rather than trying
  all three: the others are the same value through an exchange rate. Both sides come out of Postgres
  `numeric` as decimal strings reporting the same figure, so there is nothing for a tolerance to
  absorb — a near miss is a different event. A buy debits and a sale, redemption, dividend or interest
  payment credits; actions the bank files with no cash direction of their own (stock distributions,
  deposit transfers) are matched on date, amount and account alone rather than being force-fitted to a
  sign the source never implies.

The Poalim account tuple is still required on top, so the same security trading in two of a tenant's
portfolios cannot cross-match. Pairing is now explicitly **one-to-one and greedy**, oldest execution
first: a security can be executed several times in a day for the same amount, and each execution
belongs to exactly one cash movement.

The matcher is also usable from both ends. `matchSecurityExecutions` keeps its charge-side signature
(matched executions grouped by security key), and the new `matchExecutionsToTransactions` returns the
cash movement behind each execution — the direction a per-security history needs to link a trade back
to its charge.

Because the date rule is exact, the provider's prefilter is now `value_date = ANY(<the charge's debit
dates>)` instead of a padded range over four date columns, and it selects `settlement_currency` for
the currency pick.
