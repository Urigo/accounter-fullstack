---
'@accounter/server': patch
---

Structured DB-client lines and a quieter pool heartbeat (part of #4872).

- The DB-client lines (`db-leaked-connection-reclaimed`, `db-checked-out-client-error`,
  `db-client-outside-live-request`, disposal failures) are JSON records with `operationName` and
  `requestId` fields instead of `[db] …` text. Log queries that match the old text need updating.
- `db-pool-heartbeat` is written every 5 minutes while the pool is idle, instead of on every tick.
  It still reports on every tick while anything is checked out, waiting or held.
