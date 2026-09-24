---
'@accounter/server': patch
---

Dynamic report snapshots now expose their leaf approvals: `DynamicReportSnapshot.approvals` returns
each stamped status with its time, whether the system set it, and the display name of the user who
set it (Auth0 name, else email, else invitation email; null for system stamps and for users who
are no longer members of the business). Legacy snapshots return an empty list. Display names are
resolved through a new batched `BusinessUsersProvider.getUserDisplayNamesLoader`.
