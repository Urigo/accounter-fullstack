---
'@accounter/server': patch
---

- **Database Table Duplication**: A new migration duplicate the `accounter_schema.users` table to
  `accounter_schema.legacy_business_users`, as a step of renaming the users table. This change is
  crucial for distinguishing between business entities and future personal user accounts.
- **Authentication Query Update**: The `auth-plugin.ts` file is updated to reflect the new table,
  modifying the `getUserByName` SQL query to target the `legacy_business_users` table.
- **Core User Authentication Tables**: Introduced foundational database tables for user authentication and authorization, including `roles`, `permissions`, `role_permissions`, `business_users`, and `user_permission_overrides`.
- **Auth0 Integration Readiness**: The `business_users` table is designed to link external Auth0 user IDs with internal business and role assignments, preparing the system for Auth0 integration.
- **Role-Based Access Control (RBAC)**: Implemented a role-based access control system with predefined roles (e.g., business owner, accountant) and permissions, with provisions for future granular permission management.
- **Initial Seed Data**: The migration script includes seed data for initial roles, permissions, and their mappings, providing a ready-to-use access control setup.

