---
'@accounter/server': patch
---

- **Auth0 Integration**: Integrated the Auth0 management client library to enable programmatic
  interaction with Auth0 for user management.
- **New Auth0 Module**: Introduced a new `auth` GraphQL module to encapsulate Auth0-related services
  and types within the application.
- **Auth0 Management Service**: Implemented `Auth0ManagementService` to handle creating and deleting
  users in Auth0, including generating secure temporary passwords and setting initial user states
  (blocked, unverified email).
- **Dependency Management**: Added the `auth0` package as a dependency and updated `yarn.lock` to
  reflect new and resolved package versions.
