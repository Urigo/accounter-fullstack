---
'@accounter/client': patch
---

Dynamic report: changing the period, owner or pinned baseline while review statuses are staged now asks the user to confirm discarding them. Confirming clears the staged statuses and applies the change; cancelling leaves everything as it was. Staged structural edits are kept either way.
