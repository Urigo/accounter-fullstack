---
'@accounter/server': minor
---

`updateTransactions`, `updateTransaction` and `updateDocument` now clean up after a move onto an
existing charge: a former charge the move left with no transactions, documents or misc expenses is
deleted, the same way the all-zero-UUID unlink path has always done. `updateTransactions` reports
the ids under a new `deletedChargeIds` field on `UpdatedTransactionsSuccessfulResult`;
`updateDocument` reports it through the existing `deletedChargeId`, which is now set on a move onto
an existing charge as well as on an unlink. Shared logic lives in
`charges/helpers/delete-emptied-charges.helper.ts`.
