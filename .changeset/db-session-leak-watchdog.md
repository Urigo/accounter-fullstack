---
'@accounter/server': patch
---

Fix request-scoped DB sessions leaking, and make the leak watchdog fire before Postgres does (#4871).

- Every watchdog ceiling must now be at most `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS` minus two
  sweep intervals (240s with the defaults), and the server refuses to start otherwise.
  `POSTGRES_CLIENT_MAX_IDLE_MS` now defaults to 240s, and `POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS`
  defaults to it instead of 900s. Like the aborted ceiling, the active one is never below
  `POSTGRES_STATEMENT_TIMEOUT_MS + 30s`.
- **Before deploying**, check the environment. Every effective ceiling (client, active, aborted)
  must be at most `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS` minus two sweep intervals: 240s with the
  defaults (300s timeout, 30s sweeps).
  - A configured ceiling above that limit must be lowered or removed, or the idle-in-transaction
    timeout raised.
  - The active and aborted ceilings are floored at `POSTGRES_STATEMENT_TIMEOUT_MS + 30s`, so a
    statement timeout above the limit minus 30s (210s with the defaults) also needs a higher
    idle-in-transaction timeout.
- The watchdog's reclaim line and the `[db] Error on checked-out client` line name the GraphQL
  operation and the request id. The error line is now a single line without the pg stack.
- Request lifecycle state for DB clients now lives in one shared `context.dbRequest` object. The
  client used to read flags through graphql-modules' per-module copy of the context, so
  `executionInFlight` never turned false for it and a client built after its operation was
  destroyed registered on a list nothing drained. A `TenantAwareDBClient` constructed outside a
  live request now commits and releases after every query, so it can no longer hold a connection,
  and logs one line saying so.
- Queries issued through the raw connection inside `transaction()` now count as activity, so the
  watchdog no longer takes a long transaction for a leak.
- `getVatRecords`, the corporate-tax-ruling compliance report and monthly VAT ledger generation now
  wait for every branch of their per-record fan-outs before failing. A failed branch no longer
  leaves its siblings to hit `TenantAwareDBClient is already disposed`.
