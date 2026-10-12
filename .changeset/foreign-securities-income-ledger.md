---
'@accounter/server': minor
---

Foreign securities ledger generation now reads the security execution behind each cash movement:

- dividends and bond interest are credited to (local or foreign) dividend / bond interest income
  instead of the securities account, with tax withheld from them booked to dividend or bond
  withholding tax; the reported tax is checked against gross minus net
- a bond redemption credits the securities account with the FIFO purchase cost and books the
  difference to gain or loss from sale of foreign securities
- a transaction with no matched execution, a purchase missing from the scraped history, or a
  missing securities tax category is reported as a ledger error, keeping the previous entry; the
  missing categories are also listed in the new `LedgerValidation.missingSecuritiesTaxCategories`

Buys, sales and transfers are booked as before.
