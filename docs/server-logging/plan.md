# Plan: Structured logging + Slack notifications for `@accounter/server`

> Status: **partly implemented.** The tactical PRs of epic #4869 (#4947, #4948, #4950, then the
> #4954 stack: #4960, #4961, #4962, #4963 and #4954) built the logging core, the request log and the
> DB lines with a small in-house logger. This document now plans what remains: tagging, ambient
> request context, the error funnel and crash path, Slack notifications, the migration of the
> remaining `console.*` calls, and lint enforcement. It was fact-checked against the Yoga /
> OpenTelemetry / Slack docs and the repo, then reviewed from security, feasibility and operability
> angles. Runtime claims that were only read, not run, are settled by the spikes below.

## Where things stand (main at `5d1f6b4d7`)

| Area                             | Implemented                                                                                                                                                                                                                                                                                                                                                                                 | Where                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Logger                           | `log(level, msg, fields)` and `logger.*`; one JSON line per record on **stdout** for every level (`msg`, `level`, `time`, fields); `fatal` always written; `SERVER_LOG_LEVEL` threshold (`setLogLevel`); EPIPE-safe writer                                                                                                                                                                  | `observability/log.ts`                                                       |
| Seams                            | `setLogWriter` (where a finished line goes) and `setLogContextProvider` (fields merged into every record). **Neither has a production user yet.**                                                                                                                                                                                                                                           | `observability/log.ts`                                                       |
| Safety                           | Credential-named keys redacted at any depth; every string scrubbed (JWT, `Bearer`/`Basic`, Slack webhook URLs, emails) and capped at 2000 chars; `serializeError` allowlist (name, message ≤500, code, path, 8 frames, `cause` chain; `GraphQLError` extensions never past `code`); `scrubText` exported                                                                                    | `observability/log.ts`                                                       |
| Log once                         | `markLogged` / `wasLogged`; the Yoga logger skips errors already logged                                                                                                                                                                                                                                                                                                                     | `observability/log.ts` (`createYogaLogger`)                                  |
| Request id                       | `requestIdOf`: OTel trace id, else a valid `X-Request-Id`, else UUID, memoized per request; `correlationIdOf` separate; both headers validated (`^[A-Za-z0-9._:-]{8,64}$`)                                                                                                                                                                                                                  | `plugins/correlation-id-plugin.ts`                                           |
| Request log                      | One `graphql-operation` line per operation (incl. rejected-before-execution and `@defer`), one `graphql-error` line per distinct error with `count`/`paths`, `detailLogged` when a lower boundary logged it; identity (`userId`, `businessId` after the scope header) on a shared `context.requestLog`                                                                                      | `plugins/request-log-plugin.ts`, `AuthContextProvider.recordingIdentity`     |
| Error classification             | `isUnexpectedGraphQLError`: masked by Yoga, or thrown on purpose with `INTERNAL_SERVER_ERROR`; the one predicate an alert must use                                                                                                                                                                                                                                                          | `observability/graphql-errors.ts`                                            |
| DB lines                         | `db-leaked-connection-reclaimed`, `db-checked-out-client-error` (with `code`), `db-client-outside-live-request`, disposal failures: JSON with `operationName` and `requestId`; `db-pool-heartbeat` every 5 min when idle; watchdog ceilings validated at startup; `allSettledOrThrow` for fan-outs                                                                                          | `tenant-db-client.ts`, `pool-monitor.ts`, `index.ts`, `db-cleanup-plugin.ts` |
| Lifecycle                        | `server-listening`, `server-shutting-down` (`fatal` after a crash, `info` on a signal), `server-shutdown-*`, `db-pool-idle-client-error`; no `process.std*.write` left in `src`                                                                                                                                                                                                             | `index.ts`                                                                   |
| Other fixed leaks (#4947, #4980) | Recovery- and vacation-reserve prints (vacation-reserve errors name employees by ID), JWT claim dump, per-render document logs removed; URL upload sources log only the host; Green Invoice Mesh logger level (`GREEN_INVOICE_LOG_LEVEL`); the logger never reads `DEBUG`; Green Invoice failures log `green-invoice-call-failed` with a scrubbed, capped upstream reason; VAT report fixed | `modules/**`                                                                 |
| Docs                             | Format, levels, safety, request ids, record catalog, "log once"                                                                                                                                                                                                                                                                                                                             | `docs/operations/logging.md`                                                 |

**Not done:**

- **No origin tags.** Lines carry `msg`, not `module` / `component`, and no `service` / `env` /
  `release`. This is the original "clear where logs came from" requirement.
- **No ambient context.** Only the request-log lines and the DB lines know the request id, user and
  business; any other `log()` call (and every `console.*`) knows nothing about the request.
- **383 live `console.*` calls remain** in about 30 module directories (charges 39, documents 34,
  business-trips 34, financial-entities 33, app-providers 29, auth 24, deel 21, reports 20, ledger
  17, transactions 11, tags 11, …), plus `errorSimplifier` (77 call sites, `shared/errors.ts`, still
  `console.error` with a multi-line dump), `jobs/utils.ts`, `plugins/auth-plugin.ts` and
  `telemetry/`. 20 test files spy on `console`. ESLint `no-console` is still only a warning.
- **The crash path is unchanged:** `gracefulShutdown` awaits `server.close()` before arming the
  force-exit timer, the process handlers are registered at the end of `main()`, and `main()` has no
  `.catch`.
- **No Slack notifier**, no `onCommitted` hook, no alerting of any kind.
- Open issue #4946 (VAT report data-quality) is a separate bug fix.

## Goals and decisions

**Goal:** a stable structured log with a tagging scheme that says where every line came from,
request / user / tenant correlation on every line, redaction by default (done), a hook so an
external log service can be added without touching call sites (the writer seam exists), and a
separate typed Slack notification hook for alerts and business events. Output stays on stdout for
now.

**Decisions**

- Slack: **two incoming webhooks** (alerts channel and events channel).
- Business events: **tenant created** and **invitation accepted**.
- Error alerts: **unexpected failures only** (crashes, failed jobs, DB pool trouble, unexpected
  resolver errors, quarantined email ingestions). `errorSimplifier` errors do **not** alert.
- Production: **Render, single instance**, so in-process alert dedupe is enough (document the
  N-replica caveat).
- `tenant.created` **may include the tenant (business) name** and ids. Never emails, tokens or Auth0
  ids.
- **Stay on the in-house logger; pino is not adopted.** It was the original plan, but the merged
  core already covers what pino was for (JSON lines, redaction, serializer, seams), and a second
  logging stack would mean rewriting 386 call sites to a different signature for little gain.
  Revisit only if an external sink needs worker-thread transports; it would then sit behind
  `setLogWriter`.
- **`msg` is the event id** (stable kebab-case). There is no separate `event` field, and no
  `log.error({ err }, msg)` call style.
- **Request id is the trace id when tracing is on** (merged design), so there are no separate
  `trace_id` / `span_id` fields.
- **Fail-fast `SERVER_LOG_LEVEL`** (merged); Slack configuration is fail-open.

## 1. Origin tags (PR A)

`getLogger(import.meta.url)` returns a scoped logger with the **same signatures** as `log` /
`logger.*` that binds two fields:

| Field                       | Source                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `module`                    | derived from the path: `…/modules/<dir>/…` → `<dir>` (works in `src/`, `dist/` which mirrors it, and vitest); other top-level dirs map to `plugins`, `jobs`, `telemetry`, `shared`, `observability`; `index.ts` → `startup`. Override for infra scopes: `getLogger({ module: 'shutdown' \| 'process' \| 'db' \| 'http', component })`. |
| `component`                 | file name without extension (`charges.resolver`, `deel-client.provider`) or class name                                                                                                                                                                                                                                                 |
| `service`, `env`, `release` | static base set once at startup (`accounter-server`; `OTEL_DEPLOYMENT_ENV`, else `NODE_ENV`; `RELEASE`)                                                                                                                                                                                                                                |

- **Rule: directory name == log module.** A test walks `src/modules` and proves every directory
  resolves.
- **Per-module levels:** `SERVER_LOG_LEVEL_OVERRIDES=deel=debug,db=warn`, added to the existing
  `LoggingModel` next to `SERVER_LOG_LEVEL` (fail-fast, validated). A key that matches no module
  warns once at startup. Add `silent` to the level enum for tests.
- The nine files that already call `log()` adopt `getLogger` in the same PR. Call-site fields still
  override bound ones.
- Field dictionary (in `docs/operations/logging.md`): `chargeId`, `businessId`, `transactionId`,
  `documentId`, `userId`, `count`, `durationMs`; camelCase ids, never whole domain objects, never
  emails, names, amounts or Auth0 ids.

## 2. Ambient request context (PR B)

Goal: every `log()` call inside a request, including free functions and DataLoader callbacks,
carries `requestId`, `operationName`, `userId`, `businessId` and `correlationId` without threading
them by hand (today the VAT resolver and the Green Invoice provider read them from the injector).

- `AsyncLocalStorage` store, created at the HTTP boundary:
  `createServer((req, res) => withRequestContext(req, () => yoga(req, res)))`. The store holds only
  primitives plus a reference to the operation's `RequestLogState`; `requestLogPlugin.onParams`
  attaches it, and `setLogContextProvider` returns the fields from it. The existing explicit fields
  (DB lines) override the context, because call-site fields win.
- `runWithLogContext({ tenantId }, fn)` opens a nested scope for non-request tenant work (the email
  ingestion `withTenantContext` paths, jobs). `bindLogContext` and both helpers are no-ops without a
  store.
- Fallback for tests that call `yoga.fetch()` directly: wrap in `als.run` inside `onRequest`.
- Hygiene (all testable): `withoutLogContext(fn)` (`als.exit`); long-lived things (notifier worker,
  timers, jobs) start in `main()` outside any store; borrower-owned listeners that log
  (`tenant-db-client.ts` pg `error`, the abort listener in `db-cleanup-plugin.ts`, `res` close
  handlers) are wrapped with `AsyncLocalStorage.bind`; `notify()` snapshots ids at enqueue time;
  singleton providers log with the first caller's context or none. Tests: two sequential requests on
  one pooled connection then an `'error'` emit; a notifier enqueued from request A has no
  `requestId` in worker lines.
- Optional **console shim** (after this PR): route un-migrated `console.*` through `log()` as
  `msg: 'console-<level>'`, so legacy lines gain the request ids, redaction and one-line JSON during
  the long migration. Removed in the final PR.

## 3. Error funnel and crash path (PR C)

- **`errorSimplifier`** (`shared/errors.ts`, 77 call sites; signature unchanged): log
  `log('error', 'resolver-error', { message, error: serializeError(error) })` with `module` /
  `component` taken from the caller frame (`Error.captureStackTrace`, first non-`shared` frame;
  error path only), and `markLogged` the error so the operation's `graphql-error` line says
  `detailLogged: true`. A pass-through `GraphQLError` is not logged again. It still does **not**
  alert.
- **Process handlers first:** register `uncaughtException` / `unhandledRejection` and
  `main().catch(fatal)` as the first statements of `main()`.
- **Crash path (the current flush would be unreachable):** `log('fatal', …)`, arm an absolute ~8 s
  deadline **before** `server.close`, enqueue `server.crashed` on the notifier's priority lane, then
  `Promise.allSettled([flushNotifications(remaining), server.close()])`, then `process.exit` in
  `finally`. A second fault during shutdown is logged, not dropped (today `isShuttingDown` returns
  silently). SIGINT / SIGTERM never alert. Tests: hung `server.close` and hung `pool.end` give one
  POST attempt and an exit within budget.
- Small items: `jobs/utils.ts:41` and the `auth-plugin.ts:39` dev-bypass warning move to `log`; the
  job logger in `index.ts` keeps its local `Logger {info(message, meta), error(message, meta)}`
  interface (its adapter already calls `log`); `scripts/run-invitation-cleanup.ts` stays
  console-based or adopts the same adapter; log `fatal` at startup if `ALLOW_DEV_AUTH=1` while the
  environment label is production (refusing to start is a follow-up decision).

## 4. Slack notifications (PRs D, E1 to E3)

- **Config (fail-open — invalid → disabled + one startup `warn` naming the variable, never
  `process.exit`):** `SLACK_ALERTS_WEBHOOK_URL`, `SLACK_EVENTS_WEBHOOK_URL` (zod: https, hostname
  `hooks.slack.com`, pathname `/services/…`, static error messages — `environment.ts` prints
  `error.format()`), `SLACK_ALERT_MENTION` (allow-list regex
  `^<(!subteam\^S[A-Z0-9]+|@[UW][A-Z0-9]+|!here|!channel)>$`), `SLACK_ALERT_DEDUPE_WINDOW_SECONDS`
  (300), `SLACK_MUTED_EVENTS` (validated against catalog), `SLACK_ALLOW_NON_PROD`. Webhook vars are
  **unset** in `.env.template` (a syntactically valid fake URL yields permanent 404s). URLs are held
  in a `Secret` wrapper (`toString/toJSON/inspect` → `[REDACTED]`) and are not placed on the `env`
  object spread into the Yoga context (`index.ts:167-173`). One webhook set → the other channel is
  disabled and the undelivered types are listed in the startup warn. Identical URLs share one queue.
  Slack is **inert** (`NoopNotifier`) until `main()` calls `initNotifications()`, and when the
  environment label is `development`/`test` unless `SLACK_ALLOW_NON_PROD=1`; vitest setup deletes
  `SLACK_*`.
- **Catalog:** events channel: `tenant.created`, `invitation.accepted`. Alerts channel:
  `server.crashed`, `job.failed`, `db.pool.saturated`, `db.connection.leaked`,
  `graphql.internal-error`, `email-ingestion.quarantined`. Titles are prefixed `[env]`; `release` in
  the footer.
- **Payloads = closed allowlist of ids/enums** (stack text is third-party-bound, and the first stack
  line is the error message): alerts carry `err.name/code/statusCode/sqlState`, ≤3 frames built from
  `^\s+at ` lines only, fingerprint, plus `requestId` (the trace id when tracing is on) and
  `correlationId` **when present** (they are the pivot from Slack to the log line for request-scoped
  alerts such as `graphql.internal-error`). Background alerts (`server.crashed`, scheduled
  `job.failed`, `db.pool.saturated`, `db.connection.leaked`) run outside any HTTP request, so those
  fields are optional and are omitted rather than fabricated; their pivot is the `msg` event id plus
  the fingerprint, searched in the logs around the alert time. `email-ingestion.quarantined`:
  `tenantId`, `reasonCode`, `auditId`, `correlationId` only. `tenant.created`: tenant name +
  `adminEntityId` + `createdBy` (local operator id). `invitation.accepted`: `businessId`, `roleId`,
  `userId`, `invitationId`. Never tokens, emails, Auth0 ids, SQL (`lastQuery`), subjects/filenames.
  `format.ts`: one `escapeMrkdwn()` (`&`,`<`,`>`) on every dynamic value before our own markup; the
  mention token is the only raw `<…>`; limits enforced (section ≤2900, ≤10 fields ≤1900, header ≤150
  static, blocks ≤50, no empty text objects; truncate → escape → re-check); neutralize ``` in
  stacks; always send top-level `text` fallback. Golden tests: `<!channel>`, `<!subteam^X>`,
  `<https://evil|x>` inert.
- **Delivery:** `fetch` POST, explicit `Content-Type: application/json`, `redirect: 'error'`,
  `AbortSignal.timeout(3000)`, always `await res.text()` (success = 200 `ok`, plain text). Queue per
  webhook URL, bounded 100, concurrency 1, ≥1.1 s spacing, coalesce by fingerprint (count, not
  append). Retry matrix: 429 → pause that URL for `Retry-After` (clamped 5 s) + one retry;
  5xx/network/timeout → one backoff retry; 400 → one text-only degraded resend; 403/404/410 → no
  retry + 15-min per-URL circuit breaker + single warn. The notifier never notifies about itself;
  `notify()`/`alertError()` wrap their whole body in try/catch; the pump and every timer end in
  `.catch` (an `unhandledRejection` is fatal here).
- **Dedupe/flood control:** per-event pure fingerprints over structured fields (graphql:
  operationName + field coordinate with indices as `*` + root-cause name/code/SQLSTATE; job: name +
  err name; pool: event only; quarantine: reasonCode + tenantId; fallback: sha1 of the message with
  UUIDs/digits/quotes/emails/dates normalized). 300 s window; suppressed counts ride on the next
  message; global cap 20/min then one "alert storm" summary. **Priority lane** for `server.crashed`
  bypasses dedupe, cap, bound and spacing (one attempt, no retry; mention applied only when
  `uptimeSeconds ≥ 60`, otherwise "crash loop suspected").
- **Observability of the notifier:** counters
  `{sent, failed, dropped, queued, consecutiveFailures, lastSuccessAt}` added to the
  `db-pool-heartbeat` line (only when Slack is enabled; existing keys untouched), log-only
  `notifications.delivery.degraded/recovered` events, `notify:test` script (no startup self-test).

### Hook points (re-verify line numbers while implementing; `index.ts` and `tenant-db-client.ts` have shifted)

| Event                         | Insertion point                                                                                                                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant.created`              | `AdminOnboardingProvider.bootstrapNewClient` (`modules/onboarding/providers/admin-onboarding.provider.ts`): `const result = await this.db.transaction(…)` then `notify()`; operator from `requireSuperAdmin()` | Fire **once, only on first creation, only after a successful COMMIT.** `TenantAwareDBClient.endSession` swallows a COMMIT failure and bootstrap is idempotent, so add `onCommitted(cb)` to `TenantAwareDBClient` (callbacks run only after the outermost successful COMMIT, discarded on rollback) and derive `isNew` inside the transaction (the business-user insert is `ON CONFLICT DO NOTHING RETURNING`); a re-bootstrap logs `tenant-reinvited` only. The Auth0 `createBlockedUser` call is inside the transaction and not rolled back: document it. |
| `invitation.accepted`         | `invitations.resolver.ts`, right after `await acceptInvitation(…)` returns (COMMIT is inside `accept-invitations.provider.ts`), outside the try that maps to `INVITATION_ACCEPT_FAILED`                        | Ids only (the business name needs an RLS-pinned query). Also log the swallowed cause in that resolver's catch.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `server.crashed`              | `index.ts` `gracefulShutdown`, the `exitCode !== 0` branch that logs `fatal` `server-shutting-down`, and `main().catch`                                                                                        | See section 3. SIGINT / SIGTERM never alert.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `job.failed`                  | The scheduled-job catch blocks in `index.ts` (single alert site; also when the cleanup `result.errors > 0`, since per-invitation failures are only counted)                                                    | `jobs/utils.ts` becomes log-only. `run-cron-jobs.helper.ts` is a user-triggered mutation stream: log-only, pass `tenantId` explicitly.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `db.pool.saturated`           | `pool-monitor.ts`, the `saturated` branch (`db-pool-heartbeat` at `error`)                                                                                                                                     | Alert only on `waitingCount > 0` for 2 consecutive ticks (`saturated` also fires for busy-not-wedged); re-notify after 15 min then 1 h; one "recovered" message. The heartbeat shape and `msg` stay as documented.                                                                                                                                                                                                                                                                                                                                         |
| `db.connection.leaked`        | `index.ts` `onLeak` (`db-leaked-connection-reclaimed`) **and** `db-checked-out-client-error` with `code === '25P03'` (the watchdog did not get there first)                                                    | The watchdog now fires before Postgres (ceilings validated at startup), so the 25P03 case means something is wrong. Both carry the client's `operationName` / `requestId`; exclude `lastQuery` from Slack.                                                                                                                                                                                                                                                                                                                                                 |
| `graphql.internal-error`      | `plugins/request-log-plugin.ts` `flushErrorGroups`, for groups where `isUnexpectedGraphQLError` is true and the request was not aborted                                                                        | Reuses the plugin's per-operation grouping, so one alert per distinct error with `count` / `paths`. Needs no `maskedErrors` wrapper. Fingerprint: operationName + field coordinate (indices as `*`) + root-cause name / code.                                                                                                                                                                                                                                                                                                                              |
| `email-ingestion.quarantined` | Wrap public `performIngest` (`email-ingestion-ingest.provider.ts`) in `runWithLogContext({ tenantId })` and notify only when `result.outcome === QUARANTINED`                                                  | Never inside `recordNonInsert` or any `withTenantContext` callback (re-run on a dead connection, pre-COMMIT); never for IGNORED / SELF_ISSUED. Request-scoped fields (`requestId`) are present only when the ingest came through a request.                                                                                                                                                                                                                                                                                                                |

Request-scoped alerts (`graphql.internal-error`) carry `requestId` (the trace id when tracing is on)
and `correlationId`; background alerts carry them only when known (the DB-client alerts do).

## 5. Migration sweeps and enforcement

Remaining work is the 386 `console.*` calls plus the funnel above, in descending call count
(charges, documents, business-trips, financial-entities, app-providers, auth, deel, reports, ledger,
then the small modules).

**Transform rules for sweeps** (a one-off `tsx` script on the TypeScript compiler API, no new
dependencies; roughly 40% mechanical, 20% semi-mechanical and 40% by hand, so every diff is
reviewed; splice by node range, then Prettier; leave the 62 bare `console.error(e)` and the 12
`console.*(JSON.stringify(…))` calls for a human; watch expression-body
`.catch(e => console.error(e))` and orphaned catch parameters):

- `console.error(e)`, `console.error(msg, e)` and ``console.error(`${msg}: ${e}`)`` become
  `log('error', '<kebab-event>', { …ids, error: serializeError(e) })`. Always give the event a name;
  bare dumps have none.
- Interpolated ids become structured fields; `console.log` becomes `info` or `debug` by the level
  policy; never log whole charge, document, contract or payroll objects.
- Where a helper logs an error and rethrows it, delete the log and let the boundary log it ("log
  once"). #4946 is the VAT example.
- Delete rather than migrate: the `TEMP` lines in `coinmarketcap.ts` (`${res}` prints
  `[object Response]`) and per-record debug lines such as `pcn.helper.ts:86,238` (aggregate them
  into one summary line, or drop them). Guard expensive debug payloads with `isLogLevelEnabled`.
  Deel's raw request and response dumps (`deel-client.provider.ts`, 14 calls) become
  `{ status, bytes, contentType }`.

**Merged rules a sweep must not regress (#4947, #4954 stack, #4980):** URLs are logged as host only;
employees are named by ID, never by name, in logs and error messages; an expired JWT is not logged
and any other jose error logs only `{ code, message }`; Green Invoice upstream reasons stay scrubbed
and capped; the logger never reads `DEBUG`. Tests that assert "no console output"
(`recovery-reserve.helper.test.ts`, `vacation-reserve.helper.test.ts`, `amount.test.ts`, the JWT
cases in `auth-context.test.ts`) pass vacuously once their module logs to stdout, so each sweep
ports them to a `setLogWriter` capture (`src/test-utils/capture-logs.ts`, excluded from `dist`). The
20 test files that spy on `console` migrate with their module.

**Enforcement.** Each sweep PR adds its directories to a per-directory `no-console: error` ratchet.
The final PR makes it `error` for `packages/server/src/**` with the allowlist: `environment.ts`
(tests assert it), `bootstrap-telemetry.ts`, `telemetry/index.ts`, `demo-fixtures/**`,
`scripts/run-invitation-cleanup.ts`; `@whatwg-node/server` still writes raw `console.error`
internally. Also in the final PR: remove the console shim and the three stale
`eslint-disable no-console` comments, add a "Logging" cheat-sheet to `packages/server/CLAUDE.md` and
`.claude/rules`, and fix `docs/user-providers-credentials/blueprint.md` ("use console.error").

## Future external log service (prepared)

The writer seam is the hook: an external sink is one `LogWriter` that tees to the stdout writer
(`setLogWriter`), selected at startup in `index.ts` (for example `SERVER_LOG_SINKS=stdout,…`).
Rules: redaction and serialization happen before any writer (they do: `toJsonLine`); sink errors are
isolated and never crash the process; a bounded async queue, because the default stdout write is
synchronous. A golden test pins the keys of a representative line (`msg`, `level`, `time`, `module`,
`component`, `service`, `env`, `release`, `requestId`, …). `docs/operations/logging.md` gains a
delta table against `mcp-server` / the gateway (`message` vs `msg`, `timestamp` vs `time`) and a
data-handling section (stores: host logs, Slack channels, Tempo; retention; the "never log"
dictionary). Candidate backend: OTLP logs to Grafana Loki (Tempo is the trace backend). Require a
processor / DPA / region review before any external sink lands.

## Plan of PRs (small, independently revertible; squash-merge; `yarn lint` + `yarn generate` first)

| PR  | Scope                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Done (#4980).** Delete the vacation-reserve prints (names and amounts), with a "logs nothing" test like the recovery-reserve one; its errors name employees by ID. No logger needed.                                                                                                                   |
| A   | Origin tags: `getLogger`, base fields, per-module levels, `silent`; adopt in the nine files that use `log()`; module-walk test; docs. Add `capture-logs.ts`.                                                                                                                                             |
| B   | Ambient context: `withRequestContext`, store, `setLogContextProvider` wiring, hygiene, `yoga.fetch()` fallback; spikes; optional console shim.                                                                                                                                                           |
| C   | `errorSimplifier`, crash path, handlers first, `jobs/utils.ts`, `auth-plugin.ts`, `ALLOW_DEV_AUTH` guard.                                                                                                                                                                                                |
| D   | Notifications core: Noop + Slack client / queue / format / throttle (injected `fetch`), `SlackModel` (fail-open), `notify:test`, undici `ignoreRequestHook` for the Slack host in `telemetry/builder.ts`.                                                                                                |
| E1  | `onCommitted` + `tenant.created` + `invitation.accepted` + `docs/operations/slack-notifications.md`.                                                                                                                                                                                                     |
| E2  | Infra alerts: `server.crashed`, `job.failed`, `db.pool.saturated`, `db.connection.leaked` (incl. `25P03`).                                                                                                                                                                                               |
| E3  | `graphql.internal-error` (from `flushErrorGroups`) + `email-ingestion.quarantined`. Optional, **default off**: a digest of the top `errorSimplifier` call-site keys, at most one per 30 minutes (`SLACK_SIMPLIFIED_DIGEST_THRESHOLD`), so systemic failures surface without reversing "unexpected only". |
| F1  | Pilot sweep of 2 to 3 small modules (tags, contracts, misc-expenses) to validate the codemod.                                                                                                                                                                                                            |
| F2  | Critical modules: `auth`, `email-ingestion`, `scraper-ingestion`, `app-providers` (delete the `coinmarketcap.ts` `TEMP` lines; Deel raw bodies become `{ status, bytes, contentType }`).                                                                                                                 |
| F3… | Sweeps by descending call count; each ports its asserting tests in the same PR and adds its directories to the `no-console` ratchet.                                                                                                                                                                     |
| G   | Final enforcement (above).                                                                                                                                                                                                                                                                               |

PRs A to C do not depend on Slack, and D to E3 need only the seams, so A, C and D can proceed in
parallel; B should precede the E-series alerts so their `requestId` / tenant fields come from the
store.

## Day-0 spikes (inside PR B unless noted; record outcomes in `docs/operations/logging.md`)

`AsyncLocalStorage` inside `@defer` / `@stream` / SSE resolvers after the first payload, with a
keep-alive second request, and whether `als.run` at the HTTP boundary or `enterWith` in `onParams`
is the robust choice · stdout backpressure: `node app | (sleep 5; cat)` with 100k lines, measure
event-loop delay (the default writer is a synchronous `process.stdout.write`; mitigation is a
bounded async writer behind `setLogWriter`) · whether the dev `| pino-pretty` pipe renders
`{msg, level:"info", time}` (string levels; `-L` and `{levelLabel}` don't work with them) ·
`useMaskedErrors` and `incremental[].errors` · **Render staging** (PR A): how `level` / `msg` /
`fatal` render in the log viewer; if it needs `message`, rename the field in one place (`log.ts`)
and update the runbook.

## Out of scope / follow-ups

GraphQL alias / depth / token limit plugin (none today; Yoga's default body cap is 25 MB; limits
unauthenticated log and alert amplification, track before the E-series goes live) · refusing to
start with `ALLOW_DEV_AUTH=1` in production · applying the same id validation in the MCP server ·
Slack on migration failure (`packages/migrations` has its own env module) · scraper failures (run in
the user's local `scraper-app`) · Sentry · an external uptime check on `/health` and `/ready` (Slack
cannot report OOM / SIGKILL, event-loop hangs, invalid env at import, or failed deploys; state this
in the runbook).

## Verification

- Per PR: `yarn workspace @accounter/server typecheck`, `yarn lint`, `yarn prettier:check`,
  `yarn test`, `yarn test:integration` (Postgres and migrations up), `yarn generate`.
- Tags: module derivation from `src/` and `dist/` paths, a walk of `src/modules`, override parsing,
  call-site fields overriding bound ones.
- Context: propagation across `await`, timers, DataLoader batches, nested `runWithLogContext`,
  `@defer` / `@stream`, a pooled-connection `'error'` emit; no `requestId` bleed between sequential
  requests; the `yoga.fetch()` fallback.
- Errors and crash path: `errorSimplifier` logs once and the operation line says `detailLogged`;
  hung `server.close` and `pool.end` exit within budget with one POST attempt.
- Notifier: formatter goldens (limits, mention inertness), queue (timeout, 429, overflow, per-URL
  spacing), throttle (fake timers; 10,000 distinct messages keep the map bounded), never throws and
  never causes `unhandledRejection` (sync-throwing fetch, rejected fetch, stream error, throwing
  formatter, BigInt or circular field), the webhook URL never appears in any log, error or payload
  (build it at runtime in tests).
- Integration: real `createYoga` with the plugins and a writer capture: a plain `Error` in a
  resolver yields exactly one error log line and one alert; `createGraphQLError` with `FORBIDDEN`
  yields a `warn` line and no alert; `tenant.created` fires once on first bootstrap, zero on re-run,
  zero on a simulated COMMIT failure or rollback; `invitation.accepted` fires once; `QUARANTINED` vs
  `IGNORED`. Use a plain `Error` for unexpected cases and `createGraphQLError` for expected ones
  (vitest loads two `graphql` copies in some tests).
- Manual: `yarn local:setup`, `yarn workspace @accounter/server dev`, hit `/graphql`, check pretty
  and raw JSON; `kill -TERM` flush; real Slack test-workspace webhooks for both channels (does a
  mention inside a Block Kit mrkdwn section notify; status for a revoked webhook or archived
  channel; over-limit blocks give 400); the `rg "console\\.(log|info|warn|error|debug)"` gate in
  `packages/server/src` returns only the allowlist.
