# Server Logging

The server writes one JSON object per line, every level to stdout:
`{"msg": …, "level": …, "time": …, …fields}`. `msg` is a stable identifier to filter on. Values are
in fields, never spliced into `msg`. `time` is ISO 8601.

`SERVER_LOG_LEVEL` (`debug` | `info` | `warn` | `error`, default `info`) sets the minimum level for
the server's own records, Yoga and Hive (Hive forwards its logs to Yoga's logger). `DEBUG=1` has no
effect. `fatal` (the process is going down) is always written.

Levels: `fatal` the process is going down · `error` a server fault someone should look at · `warn`
handled, degraded, or the user's data needs fixing · `info` lifecycle and one line per operation ·
`debug` detail.

## Per-operation lines

Every GraphQL operation writes exactly one `graphql-operation` line when it ends:

```json
{
  "msg": "graphql-operation",
  "level": "info",
  "operationName": "ChargesScreen",
  "operationType": "query",
  "durationMs": 184,
  "errorCount": 0,
  "errorCodes": [],
  "aborted": false,
  "userId": "…",
  "businessId": "…",
  "requestId": "…",
  "correlationId": null
}
```

- An operation rejected before execution (parse or validation errors, or a failure while building
  the context) gets a line too, with its error codes.
- A streamed (`@defer`) operation is logged when the stream ends, so `durationMs` covers all of it.
- `aborted` means the caller hung up before the response was sent. The operation may still have run
  to completion.
- `userId` and `businessId` are internal IDs, set once authentication resolves. `businessId` is the
  business the operation ran as. Neither is ever an email or a token.

Each distinct error an execution returned gets one `graphql-error` line, written before Yoga masks
it:

```json
{
  "msg": "graphql-error",
  "level": "error",
  "operationName": "VatReport",
  "message": "Amount missing for invoice ID=…",
  "code": "INTERNAL_SERVER_ERROR",
  "path": "vatReport.income",
  "error": { "name": "Error", "message": "…", "stack": "at … | at …", "cause": { … } },
  "requestId": "…"
}
```

- `level` is `error` for an unexpected error and `warn` for an expected one (`FORBIDDEN`,
  `NOT_FOUND`, …). Unexpected means Yoga masks it (the client sees `Unexpected error.`) or it was
  thrown on purpose with `code: 'INTERNAL_SERVER_ERROR'` (`isUnexpectedGraphQLError` in
  `observability/graphql-errors.ts`, the one predicate an alert must use too). Only an unexpected
  error carries `error`, with the stack and `cause` chain.
- Errors with the same code and message are logged once per operation, with `count` and the first
  few `paths`. A rejected token failing every guarded field is one line.
- Yoga's own log of the errors it masks is skipped for these, so each error is logged once.
- An error whose cause a lower boundary already logged in full (`green-invoice-call-failed`) gets
  `detailLogged: true` and no `error`: the line still ties it to the operation and request.
- Errors are grouped across the whole operation, `@defer` chunks included, and written when it ends.

## Request IDs

`requestId` ties a request's lines together: `graphql-operation`, `graphql-error`, the DB lines
(`db-leaked-connection-reclaimed`, `db-checked-out-client-error`, …) and
`green-invoice-call-failed`. It comes from the `X-Request-Id` header, else the OpenTelemetry trace
ID, else a random UUID.

`correlationId` on the `graphql-operation` line is the inbound `X-Correlation-Id`, or `null`. It is
not a request ID: the MCP server sends the same one on every upstream call of a tool run, retries
included, so it groups those requests while `requestId` still tells them apart.

An inbound id is used only if it matches `^[A-Za-z0-9._:-]{8,64}$`; otherwise the request id is
minted and `correlationId` is `null` (the OTel span attribute follows the same rule). A client can't
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
- Green Invoice's own `upstreamMessage` can echo the client's data, so digit runs (tax ids, phone
  numbers) are masked as `[number]` too, and it is capped at 200 characters, in the log line and in
  the message thrown to the user.

## Other records

| `msg`                            | Level        | Meaning                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db-pool-heartbeat`              | info / error | Pool health. Every 30s while the pool is busy, every 5 minutes while idle. See [the DB pool runbook](./db-connection-pool.md).                                                                                                                                                                                                                                             |
| `db-leaked-connection-reclaimed` | error        | The watchdog reclaimed a request-scoped connection nothing disposed.                                                                                                                                                                                                                                                                                                       |
| `db-checked-out-client-error`    | error        | A checked-out connection failed (e.g. Postgres killed an idle-in-transaction session).                                                                                                                                                                                                                                                                                     |
| `db-client-outside-live-request` | warn         | Work outlived its request and built a DB client; it runs in autoRelease mode.                                                                                                                                                                                                                                                                                              |
| `green-invoice-call-failed`      | error        | A Green Invoice call failed: `greenInvoiceCall` (the SDK call), upstream `status`, Green Invoice's own `upstreamCode` / `upstreamMessage`, and the GraphQL `operationName` / `requestId`.                                                                                                                                                                                  |
| `vat-report-records-failed`      | warn         | Building VAT report records failed: `failedRecordCount`, the failing `failedRecords` (document ID and message), the first error's stack. `warn` because most such failures are a document missing an amount, currency or date (#4946). The `graphql-error` line for it is a `warn` too, because the resolver rethrows a plain `GraphQLError` so the user sees the message. |
| `server-shutting-down`           | fatal / info | The process is stopping: `fatal` with the `error` after a crash (`uncaughtException`, `unhandledRejection`), `info` on a signal. Then `server-shutdown-timed-out` / `server-shutdown-failed` (`fatal`) if it doesn't stop cleanly.                                                                                                                                         |
| `vat-report-unexpected-vat-rate` | info         | A document's VAT amount doesn't match the VAT rate for its date (the user's data, not a fault).                                                                                                                                                                                                                                                                            |

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
  of copies of one failure. Throw with `cause` and let the boundary log it. Every error that reaches
  the GraphQL response is already logged by `requestLogPlugin`, with its operation. Log where an
  error _stops_ (a catch that swallows it, returns a `CommonError`, or retries), or where only that
  site has the detail (e.g. the upstream status of a third-party call).
- Findings about the user's own data are `info`. `error` is for server faults someone should act on.
