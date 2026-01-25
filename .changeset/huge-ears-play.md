---
'@accounter/server': patch
---

- **Database Table Duplication**: A new migration duplicate the `accounter_schema.users` table to
  `accounter_schema.legacy_business_users`, as a step of renaming the users table. This change is
  crucial for distinguishing between business entities and future personal user accounts.
- **Authentication Query Update**: The `auth-plugin.ts` file is updated to reflect the new table,
  modifying the `getUserByName` SQL query to target the `legacy_business_users` table.
