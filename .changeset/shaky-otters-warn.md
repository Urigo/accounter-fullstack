---
'@accounter/server': patch
---

- Added a server script to create/match Auth0 users and seed `business_users` mappings for migration testing.
- Extended `Auth0ManagementService` with user lookup by email and optional password for blocked-user creation; adjusted password reset ticket handling.
