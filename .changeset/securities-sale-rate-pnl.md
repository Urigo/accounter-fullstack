---
'@accounter/server': minor
'@accounter/client': patch
---

Book the exchange-rate part of a securities sale or redemption apart from its price part. A second,
local-currency entry books each lot's cost × the change since the rate the securities account
carries it at: the rate the purchase's cash movement was booked at (a dividend in kind's value
date), or the rate of the last revaluation of the account it was held over, read from the
revaluations actually booked. The account then gives up exactly what it carried the units at.

- **New securities tax categories:** exchange-rate gain and loss on the sale of foreign securities.
  They are offered from the charge's ledger errors like the others, and can be pointed at the
  exchange-revaluation category to merge them.
- Until they are set, or when a purchase's cash movement is not found, the disposal is still
  booked, without the rate entry, and the year-end revaluation takes the rate PnL up as before.
