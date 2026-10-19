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
