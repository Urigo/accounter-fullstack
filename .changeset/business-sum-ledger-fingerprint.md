---
'@accounter/server': patch
---

Add `ledgerFingerprint: String!` to `BusinessTransactionSum`, the first step of accountant approval
on the dynamic report.

The fingerprint is a sha256 hex digest over the ledger records behind a business sum. It is built in
the same loop of `businessTransactionsSumFromLedgerRecords` that computes the sums, so it covers
exactly the records the sum does. Each entity slot a record touches adds one tuple: charge id, side,
slot, local and foreign amounts (normalised to 2 decimals), currency, invoice and value dates, and
the sorted entity ids on the other side. The tuples are sorted before hashing, so record order does
not matter. Record ids, `description` and `reference1` are left out, so regenerating a ledger with
the same content keeps the same fingerprint.
