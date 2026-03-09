---
'@accounter/server': patch
---

- **New GraphQL Authorization Directives**: Introduced three new GraphQL directives: `@requiresAuth` for general authentication, `@requiresRole` for specific role enforcement, and `@requiresAnyRole` for allowing multiple roles. These directives provide more granular control over access to GraphQL fields.
- **Migration to New Directives**: Replaced the deprecated `@auth` directive with the new `@requiresAuth`, `@requiresRole`, and `@requiresAnyRole` directives across numerous GraphQL type definitions, enhancing clarity and flexibility in authorization rules.
- **Refactoring Auth0 Management**: Renamed `Auth0ManagementService` to `Auth0ManagementProvider` and updated its usage and test files to reflect the new naming convention, aligning with provider patterns.
