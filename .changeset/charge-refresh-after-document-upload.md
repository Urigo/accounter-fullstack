---
'@accounter/client': patch
---

Charges screen: a charge now refreshes once a document upload to it finishes. Dropping files on a
row's "More info" cell refetches the row. An open expansion refetches too, including in expand-all
mode, where the row refetch used to leave the batched expansion stale. The "Upload Documents" modal,
the upload form and the payroll upload refresh only after something was actually uploaded. A failed
upload no longer triggers a refresh, and a failed payroll upload keeps its form open.
