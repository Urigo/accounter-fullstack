---
'@accounter/server': patch
---

Dynamic report snapshots now record accountant approvals and who saved them. `updateDynamicReportTemplate` and `captureDynamicReportBaseline` accept an optional `approvals` list on `DynamicReportSnapshotInput`, stamp each leaf against the previous comparable snapshot (same template, period and scope) inside the write transaction, and fill `created_by`. A save that omits `approvals` carries the previous snapshot's statuses forward (an `APPROVED` leaf whose fingerprint changed becomes a system-stamped `PENDING`), so a client that predates approvals cannot erase them. `insertDynamicReportTemplate` stores no approvals.
