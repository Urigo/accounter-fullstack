---
'@accounter/client': patch
---

Add "Copy Document ID", "Unlink Document" and "Delete Document" to the documents table's actions
menu, so the table offers the same actions as the edit-document modal's top bar. Unlink is disabled
for a document that is not linked to a charge, and both destructive actions keep their confirmation
dialog and the charge-deleted handling.
