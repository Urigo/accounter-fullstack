---
'@accounter/server': patch
---

Dynamic report snapshots get two new nullable jsonb columns, `leaf_fingerprints` and
`leaf_approvals`, plus an index for finding the newest snapshot with the same template, period and
scope. The server's snapshot insert now writes both columns. Every save passes `NULL` for now, so
nothing changes yet for users.
