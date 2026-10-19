---
'@accounter/server': patch
---

Edit stored ledger records manually. A new `updateLedgerRecord(ledgerRecordId, input)` mutation
overwrites the content of a single unlocked ledger record — its entities, amounts, currency, dates,
description and reference — and returns the updated record with its charge, or a `CommonError`.
Optional values left out of `LedgerRecordInput` (such as the second debit/credit slot) are cleared
rather than kept, and the record's charge, owner and lock are never changed. A successful edit
re-flags an approved charge for accountant review.

`LedgerRecord` now exposes `locked` (whether the record is locked and can no longer be edited) and
`currency` (the currency of its foreign amounts).
