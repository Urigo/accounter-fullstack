---
'@accounter/server': patch
---

- **Database Schema Update**: A new `users` table is introduced in the `accounter_schema` to store
  user names, IDs, creation timestamps, and roles, with `name` as the primary key and a foreign key
  constraint linking `users.id` to `financial_entities.id`.
- **Dynamic User Authentication**: The authentication plugin (`auth-plugin.ts`) is refactored to
  fetch user roles and associated business IDs directly from the new `users` database table,
  replacing previous static or hardcoded role assignments.
- **Enhanced Password Encryption Validation**: The `encrypt-password.mjs` script now includes more
  comprehensive validation checks for bcrypt, confirming that unique salts are used and hashes are
  correctly compared against plaintext.
