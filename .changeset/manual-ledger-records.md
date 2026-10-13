---
'@accounter/server': patch
---

Edit stored ledger records manually. A new `updateLedgerRecord(ledgerRecordId, input)` mutation
overwrites the content of a single unlocked ledger record — its entities, amounts, currency, dates,
description and reference — and returns the updated record with its charge, or a `CommonError`.
Optional values left out of `LedgerRecordInput` (such as the second debit/credit slot) are cleared
rather than kept, and the record's charge, owner and lock are never changed. A successful edit
re-flags an approved charge for accountant review.

Manual ledger records are validated before they are saved, and every problem is reported at once
in a readable message that names the slot (Debit 1, Credit 1, Debit 2, Credit 2): each entity needs
a local amount greater than 0 and every amount needs an entity; a foreign-currency record needs a
foreign amount greater than 0 on each filled slot, while a local-currency record may not carry
foreign amounts; debit and credit local totals must balance to within 0.005; and the invoice and
value dates must both be after the ledger lock date.

`LedgerRecord` now exposes `locked` (whether the record is locked and can no longer be edited) and
`currency` (the currency of its foreign amounts).

Insert ledger records manually. A new
`insertLedgerRecord(chargeId, operation: MISC_EXPENSE, input)` mutation stores the ledger record
under the charge exactly as typed and, in the same database transaction, creates the misc expense
it represents: the credit slot-1 entity is the creditor, the debit slot-1 entity the debtor, and
the amount is the credit slot-1 amount in the record's currency (slot 2, such as VAT, stays on the
ledger record only). Either both are saved or neither is. The charge must not be locked, the input
passes the same validation as an edit, and the mutation returns the new record with its charge (an
approved charge is re-flagged for accountant review), or a `CommonError`.
