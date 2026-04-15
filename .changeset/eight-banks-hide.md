---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Update**: Added an `is_locked` column to the `dynamic_report_templates` table to
  support template locking functionality.
- **New Annual Audit Step**: Implemented Step 09 in the annual audit flow, allowing users to select
  and lock a final dynamic report template for a specific fiscal year.
- **Template Management**: Added new mutations and provider methods to lock and unlock dynamic
  report templates, with logic to prevent modification of locked templates.
- **Audit Status Tracking**: Enhanced the `annual_audit_step_status` table to include an
  `evidence_json` field for storing step-specific metadata, such as the locked template name.
