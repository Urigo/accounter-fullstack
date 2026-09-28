---
'@accounter/server': minor
---

Add comment threads to dynamic report nodes, stored in the new `dynamic_report_threads` and
`dynamic_report_comments` tables (tenant-isolated with forced RLS), with a `dynamicReportThreads`
query and `addDynamicReportComment`, `editDynamicReportComment`, `deleteDynamicReportComment` and
`setDynamicReportThreadResolved` mutations. A thread is shared by every period of its template node,
each message records the period and scope it was written in, and posting creates the thread on first
use and reopens a resolved one. Comments take effect immediately, on locked templates too, and never
touch snapshots; only the author can edit or soft-delete a message, and API-key callers cannot
write. Threads follow their template through a rename, are deleted with it, and are not copied by
Save as new.
