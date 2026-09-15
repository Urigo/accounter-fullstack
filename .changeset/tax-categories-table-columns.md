---
'@accounter/client': patch
'@accounter/server': patch
---

Tax categories screen: show the sort code key instead of its ID, and add IRS code and tax-excluded
columns.

The sort code cell rendered `name (id)`, but a sort code's ID is a composite of its key and its
owner UUID — the owner half is noise on a screen that only ever lists one owner's categories. It now
shows the key with the name underneath, matching the businesses table.

`TaxCategory.taxExcluded` is new on the schema: the flag was already stored (and settable through
`insertTaxCategory` / `updateTaxCategory`) but was never readable.
