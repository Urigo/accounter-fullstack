---
'@accounter/server': patch
---

- **Backend Schema & Logic**: Extended the GraphQL schema to support `listBusinessUsers`,
  `listInvitations`, `removeBusinessUser`, and `revokeInvitation`. Implemented corresponding
  providers and resolvers with strict tenant-based scoping and RBAC enforcement.
- **Security & Reliability**: Added comprehensive audit logging for sensitive actions, implemented
  tenant-isolation guards in database queries, and ensured robust error handling for API
  interactions.
