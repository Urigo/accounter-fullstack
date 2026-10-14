---
'@accounter/server': patch
'@accounter/client': patch
---

Insert and edit ledger records manually, from the API and from the charge view.

**Server (`@accounter/server`)**

- New `insertLedgerRecord(chargeId, operation, input)` mutation. It stores a ledger record under a
  charge exactly as typed, together with the entity the record represents: a misc expense
  (`MISC_EXPENSE`) or an INVOICE document (`DOCUMENT`, with its counterparty and VAT taken from the
  record). Either both are saved or neither is. A charge whose ledger is locked is rejected, and so
  is a document whose counterparty can't be resolved or is the charge owner.
- New `updateLedgerRecord(ledgerRecordId, input)` mutation. It overwrites one unlocked ledger
  record: its entities, amounts, currency, dates, description and reference. Values left out, such
  as Debit 2 / Credit 2, are cleared. The record's misc expense or document is not changed.
- Both mutations validate the record and report every problem at once, naming the slot:
  - every entity needs an amount greater than 0;
  - a foreign-currency record needs foreign amounts, and a local-currency record can't have any;
  - debits and credits must balance;
  - both dates must be after the ledger lock date.
- Both mutations write only to the business the request targets:
  - `insertLedgerRecord` rejects a charge of another business, with a message asking to narrow the
    business scope;
  - `updateLedgerRecord` reports a record of another business as not found;
  - a financial entity of another business is reported as not found in this business.
- Both mutations return the record with its charge, or a `CommonError`. A successful change
  re-flags an approved charge for accountant review.
- `LedgerRecord` now exposes `locked` (whether the record can still be edited) and `currency`.

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
- In the add and edit forms, the currency select is as wide as the other inputs, and each foreign
  amount shows the record currency's symbol. A long entity name is cut short with an ellipsis (the
  full name shows on hover) instead of spilling over the amounts, so the columns keep their width.
  The "Debit 2" and "Credit 2" entity pickers have a "None" option to unpick an entity; the main
  lines stay required.
