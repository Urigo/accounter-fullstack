---
'@accounter/server': patch
---

Book the exchange-rate difference again when crypto legs land on the same day. Ledger generation
only adds an `Exchange ledger record` when a charge's entries were priced at more than one point,
and since dates became `TimelessDateString` it compared days, while crypto is still priced at its
exact `debit_timestamp`. A same-day crypto internal transfer (e.g. wallet → exchange) was left
unbalanced. Entries now carry the point they were priced at, keyed the way
`ExchangeProvider.getExchangeRates` prices them: crypto by time, fiat and local currency by day.
