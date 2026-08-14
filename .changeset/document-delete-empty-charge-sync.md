---
'@accounter/client': patch
'@accounter/server': patch
---

Drop the charge row when deleting or unlinking its last document empties it. The server already
deletes a charge that is left with no documents and no transactions, but it never told the client,
which then refetched a charge that no longer exists and kept rendering a stale "shadow charge".
`deleteDocument` now returns a `DeleteDocumentResult` (`success`, `chargeId`, `deletedChargeId`)
instead of a bare `Boolean`, and `UpdateDocumentSuccessfulResult` carries a `deletedChargeId` for
the unlink path. The charge expansion forwards that signal up to the charges table, which removes
the charge instead of refetching it, and the edit-document drawer now closes after a successful
delete or unlink.
