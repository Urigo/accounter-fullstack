---
'@accounter/server': minor
'@accounter/client': minor
---

**Breaking API change:** `fetchDeelDocuments` now returns `FetchDeelDocumentsResult` — a
`DeelSyncResult { charges, issues }` or a `CommonError` — instead of `[Charge!]!`.

- The Deel sync saves each payment receipt (or unmatched invoice) in its own transaction: its
  charge, documents and `deel_invoices` rows land together or not at all. Deel downloads and file
  uploads happen before the transaction, and uploads of a unit that failed are removed again.
- What could not be synced is reported per receipt/invoice as a `DeelSyncIssue` with a code and a
  message naming the invoices, receipt or contract involved — e.g. every unknown contract, with the
  details needed to link it via `addDeelContract`. Other receipts are still synced. The client lists
  the issues in a warning toast.
- Re-matching a stored invoice to its payment deletes the charge it leaves empty, and the sync
  resets the accountant approval of existing charges it changes. A concurrent sync run can no
  longer save the same invoice twice.
- The Deel business is read from the Deel provider integration instead of being hard-coded, by
  both the sync and ledger generation.
