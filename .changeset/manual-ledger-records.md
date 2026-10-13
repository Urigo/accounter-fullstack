---
'@accounter/server': patch
'@accounter/client': patch
---

Insert and edit ledger records manually, from the API and from the charge view.

**Server (`@accounter/server`)**

- `insertLedgerRecord(chargeId, operation, input)` stores a ledger record under a charge exactly as
  typed and, in the same database transaction, creates the entity it represents. Either both are
  saved or neither is.
  - `MISC_EXPENSE` creates a misc expense: the Credit 1 entity is the creditor, the Debit 1 entity
    the debtor, and the amount is the Credit 1 amount in the record's currency. Slot 2 (such as VAT)
    stays on the ledger record only.
  - `DOCUMENT` creates an INVOICE. Its counterparty is the one slot-1 entity that is a business. On
    the credit side the document is an expense (the counterparty is the creditor and the charge
    owner the debtor), and on the debit side an income (the reverse). The total is the
    counterparty's slot-1 amount in the record's currency, the serial number is the reference, and
    the date is the invoice date. VAT is the slot-2 amount on the side opposite the counterparty
    (Debit 2 for an expense, Credit 2 for an income) when that slot holds the input or output VAT
    tax category, and 0 otherwise. The insert is rejected when neither or both slot-1 entities are
    businesses, or when the counterparty is the charge owner.
  - The charge's ledger must not be locked.
- `updateLedgerRecord(ledgerRecordId, input)` overwrites one unlocked ledger record: its entities,
  amounts, currency, dates, description and reference. Optional values left out of
  `LedgerRecordInput`, such as Debit 2 / Credit 2, are cleared rather than kept. The record's charge,
  owner and lock never change, and its misc expense or document is not touched.
- Both mutations validate the record and report every problem at once, naming the slot (Debit 1,
  Credit 1, Debit 2, Credit 2):
  - each entity needs a local amount greater than 0, and every amount needs an entity;
  - a foreign-currency record needs a foreign amount greater than 0 on each filled slot, and a
    local-currency record may not carry foreign amounts;
  - debit and credit local totals must balance to within 0.005;
  - the invoice and value dates must both be after the ledger lock date.
- Both mutations reject a charge or record that belongs to a business other than the one the request
  writes to, with a message asking to narrow the business scope. Every financial entity the record
  references must belong to that business too; an entity of another business is reported as not
  found in this business.
- Both mutations return the record with its charge, or a `CommonError`. They re-flag an approved
  charge for accountant review in the same transaction as the ledger change.
- `LedgerRecord` now exposes `locked` (whether the record can no longer be edited) and `currency`
  (the currency of its foreign amounts).

**Client (`@accounter/client`)**

- A charge's ledger section is now always shown, even before it has any records. Unless the charge's
  ledger is locked, it has a "+" button next to "Regenerate Ledger" that opens a form to add a
  record. The form has:
  - the operation (misc expense or document);
  - invoice and value dates, an optional description and reference, and the currency (the local
    currency by default);
  - a debit and a credit line, each with an entity and a local amount;
  - optional "Debit 2" and "Credit 2" lines (for example input VAT on a document), each with a
    clear (×) action.
- Choosing another currency adds a foreign amount to every line. Switching back to the local
  currency clears them, and a local-currency record never sends foreign amounts.
- Live debit and credit totals and their difference are shown under the lines. The difference turns
  red while the record is out of balance.
- The form checks the same rules as the server before submitting and shows every problem at once.
  If the server rejects the record, its error is shown as a toast and the dialog stays open.
- The charge's ledger table has an "Actions" column with a pencil on every unlocked stored record,
  including ones the ledger check marks as "Diff" or "Deleted". Locked records and generated "New"
  rows have none, and other ledger tables stay read-only.
- The pencil opens the same form without the operation, prefilled with the record's currency,
  dates, description, reference and all four lines. Saving overwrites the record, and the charge
  then refreshes, so the ledger check shows where the edit differs from the generated record.
