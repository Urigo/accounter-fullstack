---
'@accounter/client': patch
---

Charges screen: a charge now refreshes once a document upload to it finishes. Dropping files on a
row's "More info" cell refetches the row. After a drop or an action from the row's actions menu, the
expansion refreshes too, including in expand-all mode, where the row refetch used to leave the
batched expansion stale. This also covers a row collapsed while expand-all is on, so it shows the
new documents once expanded again. The "Upload Documents" modal, the upload form and the payroll
upload refresh only after something was actually uploaded. A failed upload no longer triggers a
refresh, and a failed payroll upload keeps its form open.
