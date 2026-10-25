---
'@accounter/server': patch
---

Book a cancelled foreign-securities dividend or bond interest payment as the reversal of its income
entry. The cancellation's cash leg used to stay on the securities account, with a "booking the
reversal is not supported yet" ledger error, so the cancelled payment's income and withheld tax were
never reversed. It now debits the income with the gross, credits the bank with the net paid back,
and credits the withholding-tax category with the tax the bank reverses.

The reversal is priced at the rate of the payment it cancels, found among the charge's matched
executions by security, trade type and gross, so its income and withheld tax net out in shekels too.
When that payment is not in the charge, the reversal is priced at the cancellation day's rate and a
ledger error says so. The withheld-tax consistency check reads a cancellation's negated tax against
its reversed cash. A cancelled redemption is still reported as not supported.
