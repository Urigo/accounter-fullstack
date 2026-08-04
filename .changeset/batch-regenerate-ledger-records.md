---
'@accounter/server': minor
'@accounter/client': minor
---

Support batch ledger-record regeneration from the charges table.

The `regenerateLedgerRecords` mutation now accepts a list of charge ids
(`chargeIds: [UUID!]!`) and returns a `GeneratedLedgerRecords` result per charge, in order. Each
charge is regenerated independently, so a single failure surfaces as a per-charge `CommonError`
instead of aborting the whole batch.

On the client, the charges table's selection-column header now exposes a bulk-actions menu with a
"Regenerate ledger" option that regenerates the ledger for all selected charges (with the same
confirmation modal as the per-charge button). The existing per-charge regenerate button calls the
same mutation with a single-element array.
