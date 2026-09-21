---
'@accounter/server': patch
'@accounter/client': patch
---

Fix the balance report dropping transactions that have no `debit_date`. Both `debit_date_override`
and `debit_date` are nullable, so a transaction carrying only a `debit_timestamp` or an `event_date`
got a NULL `month`/`year` and was then filtered out by the outer `debit_date BETWEEN` — missing from
every period bucket rather than landing in the wrong one. The date now falls back through
`debit_timestamp` and `event_date`, and the exchange-rate lateral join uses that same coalesced date
instead of the raw `t.debit_date`, which had been ignoring `debit_date_override` (converting
overridden transactions at the pre-override day's rate) and leaving `amount_usd` NULL for date-less
ones. On the client, the screen drops a stray `console.log` and the grouping memo now depends on the
`filter` object itself rather than a hand-enumerated list of its fields.
