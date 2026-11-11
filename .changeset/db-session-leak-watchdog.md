---
'@accounter/server': patch
---

Fix request-scoped DB sessions leaking, and make the leak watchdog fire before Postgres does (#4871).

- Every watchdog ceiling must now be at most `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS` minus two
  sweep intervals, and the server refuses to start otherwise. `POSTGRES_CLIENT_MAX_IDLE_MS` now
  defaults to 240s, and `POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS` defaults to it instead of 900s (and, like the aborted ceiling,
  is never below `POSTGRES_STATEMENT_TIMEOUT_MS + 30s`). A
  deployment that sets `POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS` to 240s or more must remove it or raise
  the idle-in-transaction timeout.
- The watchdog's reclaim line and the `[db] Error on checked-out client` line name the GraphQL
  operation and the request id. The error line is now a single line without the pg stack.
- A `TenantAwareDBClient` constructed after its request's cleanup commits and releases after every
  query, so it can no longer hold a connection. It also logs one line saying so.
- `getVatRecords`, the corporate-tax-ruling compliance report and monthly VAT ledger generation now
  wait for every branch of their per-record fan-outs before failing. A failed branch no longer
  leaves its siblings to hit `TenantAwareDBClient is already disposed`.
