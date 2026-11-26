---
'@accounter/server': patch
---

`seedAdminCore` (the `yarn seed:admin-context` seeder) takes an optional business name, used by the
new root `yarn local:tenant` script. The default, `Admin Business`, is unchanged.
