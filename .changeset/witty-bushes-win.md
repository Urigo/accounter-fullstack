---
'@accounter/server': patch
---

- **Invitation Creation Mutation**: Introduced a new GraphQL mutation `createInvitation` allowing
  `business_owner` roles to invite new users to their organization.
- **Auth0 Integration**: Integrated with the Auth0 Management API to create blocked user accounts
  for invited individuals, ensuring centralized user management.
- **Robust Error Handling**: Implemented comprehensive error handling for Auth0 API interactions,
  gracefully managing rate limits and conflicts (e.g., user already exists) by mapping them to
  specific GraphQL errors.
- **Database Persistence and Audit Logging**: Ensured that invitation details are persisted in the
  database, a corresponding `business_users` record is pre-created, and an audit log entry is
  generated for each invitation created.
