---
'@accounter/server': minor
---

Expose a sale's or redemption's capital gain as `SecurityExecution.capitalGain`, from the FIFO lots
of its account, at the Bank of Israel rates of the trade dates: in the origin currency, nominal, and
split into price and exchange-rate parts, plus the s.88 inflationary amount and real gain using the
CPI known on the trade dates — a company's split; an individual's foreign-currency securities take
the exchange rate as the index, as the bank does. It is broken down by lot.
