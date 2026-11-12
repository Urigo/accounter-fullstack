# Server Logging

The server writes one JSON object per line, every level to stdout:
`{"msg": …, "level": …, "time": …, …fields}`. `msg` is a stable identifier to filter on. Values are
in fields, never spliced into `msg`. `time` is ISO 8601.

`SERVER_LOG_LEVEL` (`debug` | `info` | `warn` | `error`, default `info`) sets the minimum level for
the server's own records, Yoga and Hive (Hive forwards its logs to Yoga's logger). `DEBUG=1` has no
effect. `fatal` (the process is going down) is always written.

Levels: `fatal` the process is going down · `error` a server fault someone should look at · `warn`
handled, degraded, or the user's data needs fixing · `info` lifecycle · `debug` detail.

## Request IDs

`requestId` ties a request's lines together: the DB lines (`db-leaked-connection-reclaimed`,
`db-checked-out-client-error`, …). It comes from the `X-Request-Id` header, else the OpenTelemetry
trace ID, else a random UUID.

`X-Correlation-Id` is not a request ID: the MCP server sends the same one on every upstream call of
a tool run, retries included, so it groups those requests while `requestId` still tells them apart.

An inbound id is used only if it matches `^[A-Za-z0-9._:-]{8,64}$`; otherwise the request id is
minted, and a correlation id is ignored (and not set as the OTel span attribute). A client can't
plant an id that collides with a real one, or put arbitrary text on every line of a request.

## Safety

Every record goes through the same checks, whatever the call site passed:

- A field whose key names a credential (`authorization`, `cookie`, `set-cookie`, `x-api-key`,
  `x-gateway-cp-token`, `x-dev-auth`, `x-business-scope`, `connectionString`, and any key ending in
  `token`, `secret`, `password` or `apiKey`) is written as `[REDACTED]`, at any depth.
- Every string is scrubbed of JWTs, `Bearer`/`Basic` credentials, Slack webhook URLs and email
  addresses (`[jwt]`, `Bearer [redacted]`, `[slack-webhook]`, `[email]`), and capped at 2000
  characters.
- Errors keep an allowlist: name, message (capped at 500 characters), code, path, 8 stack frames and
  the `cause` chain. A `GraphQLError`'s `extensions` never get past `code`; a thrown plain object
  keeps only its name, message, code and status.

## Other records

| `msg`                            | Level        | Meaning                                                                                                                                                                                                                            |
| -------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db-pool-heartbeat`              | info / error | Pool health. Every 30s while the pool is busy, every 5 minutes while idle. See [the DB pool runbook](./db-connection-pool.md).                                                                                                     |
| `db-leaked-connection-reclaimed` | error        | The watchdog reclaimed a request-scoped connection nothing disposed.                                                                                                                                                               |
| `db-checked-out-client-error`    | error        | A checked-out connection failed (e.g. Postgres killed an idle-in-transaction session).                                                                                                                                             |
| `db-client-outside-live-request` | warn         | Work outlived its request and built a DB client; it runs in autoRelease mode.                                                                                                                                                      |
| `server-shutting-down`           | fatal / info | The process is stopping: `fatal` with the `error` after a crash (`uncaughtException`, `unhandledRejection`), `info` on a signal. Then `server-shutdown-timed-out` / `server-shutdown-failed` (`fatal`) if it doesn't stop cleanly. |

## Writing logs

Use `log` / `logger` from `packages/server/src/observability/log.ts`, not `console.*`:

```ts
import { log, serializeError } from '../../observability/log.js'

log('error', 'thing-failed', { thingId, error: serializeError(error) })
```

`log(level, msg, fields)` is the stable call-site API. Behind it, `setLogContextProvider` merges
fields into every record (the seam for ambient request context via `AsyncLocalStorage`) and
`setLogWriter` decides where a finished line goes (the seam for tests and another sink), so neither
needs call sites to change. The default writer swallows a failed write (`EPIPE`), as `console.*`
does.

- Internal IDs only. Never emails, names, tokens, request bodies or upstream response bodies. The
  safety checks above are a backstop, not a licence.
- **Log once, at the boundary.** Don't log an error and rethrow it: a fan-out turns that into dozens
  of copies of one failure. Throw with `cause` and let the boundary log it. Log where an error
  _stops_ (a catch that swallows it, returns a `CommonError`, or retries), or where only that site
  has the detail (e.g. the upstream status of a third-party call).
- Findings about the user's own data are `info`. `error` is for server faults someone should act on.
