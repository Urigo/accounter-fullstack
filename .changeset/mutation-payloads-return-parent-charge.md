---
'@accounter/server': patch
'@accounter/client': patch
---

Transaction, misc-expense, document, deposit, ledger, depreciation and charge-generator mutations
now return the record they changed and its charge's new state, not just an id - a prerequisite for
the normalized client cache. New additive fields carry the charge where none could:
`Transaction.charge`, `DeleteDocumentResult.charge` and `Ledger.charge`. Document payloads mirror
the documents table row except for `issuedDocumentInfo.originalDocument`, so a Green Invoice
failure can't report an already-committed write as failed. `regenerateLedgerRecords` now responds
with the charge's full stored ledger instead of only the changed records (whose new ones carried a
placeholder id), and degrading or setting a charge's accountant approval no longer leaves the
pre-update approval cached for the rest of the request.
