---
'@accounter/server': patch
'@accounter/client': patch
---

Bank deposits: new `BankDeposit.timeline` (per-event principal flow, revaluation, capitalized
interest, tax withheld, balance after, and where the figures come from: bank report, allocated or
inferred), plus the bank tax rows of the deposit's account that match no deposit event. The deposit
transactions table shows the capitalized interest, tax and revaluation rows in line, so the balance
closes at zero, and warns about unmatched bank tax rows.
