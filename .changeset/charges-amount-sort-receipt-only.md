---
'@accounter/server': patch
---

Fix `allCharges` sorting by `AMOUNT` / `ABS_AMOUNT` for receipt-only and proforma-only charges.

The sort key (`event_amount` in `getChargesByFilters`) took the receipts sum only when the
counterparty business had `can_settle_with_receipt = true`, and never considered proforma
documents. Charges backed solely by such documents got a `NULL` amount, so they collapsed onto the
`id` tiebreak and were emitted in an arbitrary block at the head/tail of the result — while the
client still displayed their receipt amount, making the list look unsorted.

The documents amount now follows the same precedence the client displays
(`getChargeDocumentsMeta`): invoices (incl. invoice-receipts and credit invoices) when any exist,
else receipts, else proforma, else fall back to the transactions sum.
