---
'@accounter/server': patch
---

- **Database Schema**: Added a new table `annual_audit_step_status` to track the status of annual
  audit steps, including support for notes and evidence.
- **GraphQL Module**: Introduced a new `annual_audit` GraphQL module to manage audit step statuses,
  including queries for fetching statuses and mutations for updating them.
