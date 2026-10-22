---
'@accounter/server': patch
---

Book a cancelled foreign-securities dividend or bond interest payment as the reversal of its income
entry. The cancellation's cash leg used to stay on the securities account, with a "booking the
reversal is not supported yet" ledger error, so the cancelled payment's income and withheld tax were
never reversed. It now debits the income with the gross, credits the bank with the net paid back,
and credits the withholding-tax category with the tax the bank reverses. The withheld-tax
consistency check reads a cancellation's negated tax against its reversed cash. A cancelled
redemption is still reported as not supported.
