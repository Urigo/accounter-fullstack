---
'@accounter/server': patch
---

Securities sale ledger: find the year-end revaluation a sold lot was held over by the dates the revaluation counts records on (the purchase's event date or a dividend in kind's trade date, and the sale's event date) rather than by their debit dates, so a trade debited across a year-end no longer leaves a local-currency balance in the securities account
