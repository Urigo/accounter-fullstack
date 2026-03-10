---
'@accounter/server': patch
---

- **Centralized Audit Logging**: Introduced a dedicated AuditLogsProvider to centralize and
  standardize audit log entries across the application, improving consistency and maintainability.
- **Refactored Audit Log Calls**: Refactored existing audit log calls in invitation-related
  functionalities (creation, acceptance, cleanup) to utilize the new AuditLogsProvider.
- **Migration Data Integrity**: Enhanced the 'add-user-id-to-invitations' migration with a check to
  ensure the invitations table is empty before adding a non-nullable user_id column, preventing data
  integrity issues.
- **New Audit Event Types**: Defined a new AuditEvent type to provide a structured and type-safe way
  to log audit events, along with comprehensive unit tests for the new provider.
