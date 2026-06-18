---
'@accounter/client': patch
---

- **Backend Schema**: Extended the GraphQL schema to support `listBusinessUsers`,
  `listInvitations`, `removeBusinessUser`, and `revokeInvitation`.
- **Frontend UI Implementation**: Scaffolded the new 'Access Management' dashboard with tabbed views
  for API Keys, Invitations, and Users. Integrated data tables, Zod-validated forms, and
  confirmation modals for destructive actions.
