---
'@accounter/server': minor
---

Charges left empty (no transactions, documents or misc expenses) after their records move to
another charge or are deleted are now deleted, instead of lingering as ghost charges. This applies
to `updateTransaction`, `updateTransactions`, `updateDocument`, `deleteDocument`,
`updateMiscExpense`, `deleteMiscExpense` and the Deel documents fetch, through a shared
`deleteChargesIfEmpty` helper. Moving onto an existing charge is now covered too (previously only
unlinking was), as is unlinking several transactions of the same charge. Updates that do not change
the charge skip the check.

`UpdatedTransactionsSuccessfulResult` gains `deletedChargeIds: [UUID!]!`, and
`UpdateDocumentSuccessfulResult.deletedChargeId` is now also set when a document moves onto an
existing charge, so clients can drop the deleted charges' rows instead of refetching them.
