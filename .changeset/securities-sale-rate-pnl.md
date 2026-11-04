---
'@accounter/server': minor
'@accounter/client': patch
---

Book the exchange-rate part of a securities sale or redemption apart from its price part. A second,
local-currency entry books each lot's cost × the change since the rate it was bought at: the rate
the purchase's cash movement was booked at (a dividend in kind's value date).

- **New securities tax category:** exchange rate on foreign securities. It is offered from the
  charge's ledger errors like the others, and can be pointed at the exchange-revaluation category
  to merge them.
- Until it is set, or when a purchase's cash movement is not found, the disposal is still
  booked, without the rate entry, and the year-end revaluation takes the rate PnL up as before.
