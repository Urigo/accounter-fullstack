---
'@accounter/server': patch
'@accounter/client': patch
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

Both mutations save the ledger change and the charge's re-flagging in one transaction. They reject
a charge or ledger record that belongs to a business other than the one the request writes to, with
a message asking to narrow the business scope to that business.

`insertLedgerRecord` also supports `operation: DOCUMENT`, which creates the INVOICE document the
record represents in the same transaction. Its counterparty is the one main (slot-1) debit or credit
entity that is a business: on the credit side the document is an expense (the counterparty is the
creditor and the charge owner the debtor), on the debit side an income (the reverse). The total is
the counterparty's slot-1 amount in the record's currency, the serial number is the reference and
the date is the invoice date. VAT is the slot-2 amount on the side opposite the counterparty (debit
2 for an expense, credit 2 for an income) when that slot holds the input or output VAT tax category,
and 0 otherwise. The insert is rejected when neither or both main entities are businesses, or when
the counterparty is the charge owner.

Every financial entity a manual ledger record references (both operations of an insert, and an
edit) must belong to the business the request writes to; an entity of another business in the read
scope is reported as not found in this business.

Both mutations are covered by database-backed integration tests: the stored rows, the rollback of
every write when one fails, the lock rules, and a manual record matching the generated ledger.

Add ledger records from the charge view. Every charge's ledger section is now shown, even before it
has any records, and unless the charge's ledger is locked it has a "+" button next to "Regenerate
Ledger". It opens a form to pick the operation (misc expense or document), the invoice and value
dates, an optional description and reference, the record's currency (the local currency by
default), and a debit and a credit entity with their local amounts. Choosing another currency adds a
foreign amount to each line; switching back to the local currency clears them, and a local-currency
record never sends foreign amounts. Optional secondary "Debit 2" and "Credit 2" lines (for example
input VAT on a document) take an entity and amounts too, and each has a clear (×) action that
empties it. Live debit and credit totals and their difference are shown under the lines, and the
difference turns red while it is out of balance. The form checks the same rules as the server
before submitting, and shows every problem at once: both main entities and positive amounts are
required, a filled secondary line needs a positive amount and an amount needs an entity, a
foreign-currency record needs a positive foreign amount on every filled line, the debit and credit
local totals across all lines must balance to within 0.005, and both dates must be after the
ledger lock date. On success the dialog closes and the charge
refreshes; if the server rejects the record, its error is shown and the dialog stays open.
