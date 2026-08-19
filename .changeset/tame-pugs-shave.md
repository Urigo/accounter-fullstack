---
'@accounter/server': patch
---

Fix Postgres connection leak that wedged the server on cancelled requests

A request cancelled mid-execution never fired `onExecuteDone`, so its pooled connection was never
released and its transaction never closed — Postgres kept the session `idle in transaction`
indefinitely. Since urql aborts the in-flight query on every keystroke, each cancelled search leaked
one connection permanently; once the leaks reached `POSTGRES_MAX_CLIENTS`, every request hung in
`pool.connect()` until the process was restarted.

Clients are now disposed on the request's `AbortSignal`, with three independent backstops: a
watchdog that reclaims connections idle beyond a ceiling, pool-level timeouts
(`connectionTimeoutMillis`, `statement_timeout`, `idle_in_transaction_session_timeout`, TCP
keepalive) so exhaustion errors loudly instead of hanging, and an `'error'` listener on checked-out
clients that returns a broken connection to the pool instead of losing the slot.

Adds a `db-pool-heartbeat` log line reporting pool saturation, connection holders, and event-loop
delay, plus `application_name` on connections so app sessions are identifiable in
`pg_stat_activity`. New optional env vars: `POSTGRES_CONNECTION_TIMEOUT_MS`,
`POSTGRES_STATEMENT_TIMEOUT_MS`, `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS`,
`POSTGRES_CLIENT_MAX_IDLE_MS`, `POSTGRES_WATCHDOG_INTERVAL_MS`, `POSTGRES_MONITOR_INTERVAL_MS` — all
defaulted, see `docs/operations/db-connection-pool.md`.
