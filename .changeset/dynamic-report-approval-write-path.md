---
'@accounter/server': patch
---

Dynamic report snapshots now record accountant approvals and who saved them. `updateDynamicReportTemplate` and `captureDynamicReportBaseline` accept an optional `approvals` list on `DynamicReportSnapshotInput`, stamp each leaf against the previous comparable snapshot (same template, period and scope) inside the write transaction, and fill `created_by`. `insertDynamicReportTemplate` stores no approvals.
