---
'@accounter/server': patch
---

Fix the Deel step of the cron jobs, which failed on recent Deel payment data. Receipts paid with
the new `dbc_credits` payment method, and workers without an ID, now pass validation. A zero-amount
invoice whose payment breakdown has no currency is saved in the invoice's own currency instead of
failing the database insert, and a non-zero invoice in that state fails with an error naming it.
Validation errors from the Deel API now log the value that was received.
