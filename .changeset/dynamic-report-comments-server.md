---
'@accounter/server': minor
---

Add comment threads to dynamic report nodes: new RLS-isolated `dynamic_report_threads` /
`dynamic_report_comments` tables, a `dynamicReportThreads` query, and mutations to add, edit, delete
(soft, author only) and resolve/reopen. One thread per template node, shared across periods; writes
apply immediately (locked templates included), never touch snapshots, and follow the template
through rename and delete.
