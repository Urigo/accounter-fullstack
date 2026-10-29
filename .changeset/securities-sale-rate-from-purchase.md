---
'@accounter/server': minor
'@accounter/client': patch
---

Measure the exchange-rate part of a securities sale or redemption from the purchase alone, ignoring
the year-end revaluations its lots were held over: each lot's cost × (the cash leg's rate − the rate
its cost was booked at). A revaluation already booked on the lots stays in the securities account
after the disposal, and the next year-end revaluation reverses it. Disposal ledgers no longer read
the securities account's ledger.

- **One sale gain category:** a disposal's price gain or loss is booked to "Gain from sale of
  foreign securities" alone (a loss as a debit); "Loss from sale of foreign securities"
  (`FOREIGN_SECURITIES_SALE_LOSS`) is removed.
- **One exchange-rate category:** "Exchange rate on foreign securities"
  (`FOREIGN_SECURITIES_EXCHANGE_RATE`) replaces the exchange-rate gain and loss on sale categories
  (`FOREIGN_SECURITIES_SALE_EXCHANGE_GAIN` / `_LOSS`).
- A migration folds the removed keys of each tenant's securities configuration into the remaining
  ones, without overwriting one already set.
- The exchange-rate entry is described as "Exchange rate on sale" (or redemption) instead of "Sale
  revaluation".

Existing disposal ledgers change when regenerated; ledgers in a locked period are not touched.
