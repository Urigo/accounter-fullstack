---
'@accounter/client': patch
---

Remove a charge's row from the charges table after it is deleted. Deleting from the charge actions
menu previously triggered the row's refetch, which failed because the charge no longer existed and
left the stale row in the table. The menu now reports a successful deletion separately, and the
table drops the charge from its rows and from the row selection.
