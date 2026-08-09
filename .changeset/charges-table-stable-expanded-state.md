---
'@accounter/client': patch
---

Keep expanded charges open across data refreshes in the charges table. Editing a document from a
charge's extended info (e.g. picking a creditor) refetches the charge, and TanStack Table v9 treated
the new `data` array as a row-structure change and reset the expanded state — collapsing every open
charge on the screen.

Deleting or unlinking a document from the edit-document modal now also refreshes the owning charge,
so the documents table reflects the change immediately.
