# Database Connection Pool — Runbook

## The failure this guards against

The server holds one pooled Postgres connection per in-flight GraphQL request, inside an open
transaction (see `TenantAwareDBClient`). If a request ends without disposing its client, that
connection is never returned to the pool and its transaction is never closed. Postgres shows the
session as `idle in transaction` with `wait_event = ClientRead`, forever.

Leak enough of them and the pool (`POSTGRES_MAX_CLIENTS`, default 20) is exhausted. From that moment
every request hangs in `pool.connect()`:

- CPU near zero, memory flat — the process is waiting, not working
- the database looks perfectly healthy: low CPU, zero failed connections, no errors anywhere
- Yoga logs `Processing GraphQL Parameters` with no matching `done.`
- new requests may stop appearing in the logs entirely, because the browser's ~6 sockets per origin
  are all consumed by hung requests and the rest queue client-side
- only a process restart recovers it

The original cause was request cancellation: `dbCleanupPlugin` disposed clients in `onExecuteDone`,
which never fires when a client aborts mid-execution (urql cancels the in-flight query on every
keystroke of a search box). Each cancelled search leaked one connection permanently.

## Diagnosing

Run against the app database — `application_name` is set to `accounter-server`, so app connections
are identifiable:

```sql
select pid, application_name, state, wait_event,
       now()-xact_start as xact_age, left(query,120) as query
from pg_stat_activity
where backend_type = 'client backend'
order by xact_start nulls last;
```

Any `idle in transaction` row with an `xact_age` beyond a few minutes is a leak. The `query` column
names the code path it leaked from (it is the _last_ statement that ran on the session, not
necessarily the culprit).

From the app side, the heartbeat log (`msg: "db-pool-heartbeat"`, every
`POSTGRES_MONITOR_INTERVAL_MS`) reports the same thing from inside the process:

```json
{
  "msg": "db-pool-heartbeat",
  "pool": { "total": 20, "idle": 0, "waiting": 7, "max": 20 },
  "sessions": { "holdingConnection": 20, "maxIdleMs": 431000 },
  "eventLoopDelayP99Ms": 3
}
```

`waiting > 0` with `idle: 0` **is** the wedge. It is logged at error level with `saturated: true`. A
high `sessions.maxIdleMs` means something is holding a connection without querying — a leak in
progress. The heartbeat still printing at all proves the event loop is alive, which rules out a
whole class of unrelated theories in one line.

## Layers of defence

Four independent mechanisms, deliberately overlapping — the bug class here is "a cleanup path that
does not run", so no single mechanism is trusted:

1. **Disposal on abort** (`dbCleanupPlugin`) — fixes the root cause: the request's `AbortSignal`
   disposes the client when the caller goes away.
2. **Watchdog** (`startTenantDbClientWatchdog`) — sweeps every connection holder and force-disposes
   any that has not issued a query in `POSTGRES_CLIENT_MAX_IDLE_MS`. The predicate is _idle_ time,
   not age, so a slow-but-active request is untouched while a leaked one is reclaimed.
3. **`connectionTimeoutMillis`** — an exhausted pool now produces fast, loud errors naming the
   operation instead of silently hanging forever.
4. **`idle_in_transaction_session_timeout`** — Postgres itself terminates an abandoned session.

## Configuration

| Variable                                  | Default  | Notes                                                       |
| ----------------------------------------- | -------- | ----------------------------------------------------------- |
| `POSTGRES_MAX_CLIENTS`                    | `20`     | Pool size. Keep well under the server's `max_connections`.  |
| `POSTGRES_CONNECTION_TIMEOUT_MS`          | `10000`  | Never set to `0` in production — that means "wait forever". |
| `POSTGRES_STATEMENT_TIMEOUT_MS`           | `120000` | Bounds a pathological query. Raise if bulk jobs need it.    |
| `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS` | `300000` | See the warning below before lowering.                      |
| `POSTGRES_CLIENT_MAX_IDLE_MS`             | `300000` | Client-side counterpart of the above.                       |
| `POSTGRES_MONITOR_INTERVAL_MS`            | `30000`  | `0` disables the heartbeat.                                 |

### Why the idle timeouts are 5 minutes and not 60 seconds

The request-scoped session model keeps a transaction open for the whole request, **including across
external I/O** — document OCR via Anthropic, Green Invoice, Cloudinary. A legitimate upload can sit
idle-in-transaction for a minute or more while waiting on an upstream API. An aggressive timeout
would kill live requests. Five minutes bounds a leak to something survivable without touching real
traffic.

The right long-term fix is to stop holding a connection across external calls at all, which would
let these timeouts drop by an order of magnitude.

### Terminating leaked sessions by hand

`pg_terminate_backend` on a leaked session is safe **only** because the client now attaches an
`'error'` listener to checked-out connections. pg removes its own idle-client error handler while a
client is checked out, so without that listener a terminated backend raises an unhandled `'error'`
event, which becomes an `uncaughtException` and takes the process down. Do not remove that listener.
