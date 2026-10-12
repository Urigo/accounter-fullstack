# Plan: Structured logging + Slack notifications for `@accounter/server`

> Status: **proposed — no code implemented yet.** This document is the plan only; implementation
> lands in the follow-up PRs listed under "Migration plan". The design was fact-checked against the
> pino / OpenTelemetry / Yoga / Slack docs and the repo, then reviewed from security, feasibility
> and operability angles. Some runtime claims were verified by reading docs and source only, so the
> day-0 spikes in PR 1a confirm them by running code.

## Context

The server (`packages/server`) logs only through `console.*`: ~419 live calls in ~125 files (364
`console.error`) plus 14 `process.stderr/stdout.write` calls (`src/index.ts`,
`email-ingestion-tenant-context.helper.ts`). There is no logging library, no levels, no request
context, and no enforcement (`no-console` is a warning, `eslint.config.mjs:94`).

- Ad-hoc fragments: a `Logger {info,error}` interface
  (`src/jobs/cleanup-expired-invitations.ts:6-9`) re-implemented in `src/index.ts:102-117` and
  `src/scripts/run-invitation-cleanup.ts`; a hand-rolled JSON heartbeat
  (`src/observability/pool-monitor.ts:34-54`, documented in
  `docs/operations/db-connection-pool.md`); and `errorSimplifier` (`src/shared/errors.ts:13`, ~74
  call sites) as the de-facto "log + wrap" funnel.
- `X-Correlation-Id` only tags the OTel span (`src/plugins/correlation-id-plugin.ts`); there is no
  request id, and user/tenant identity is resolved lazily (`AuthContextProvider`), so no log line
  knows it.
- Yoga runs with its default logger and no error-reporting hook; process faults go to
  `process.stderr`.
- Real leak risk today: raw Deel payloads, whole charge/document objects, Auth0 emails/ids, employee
  names + salary-derived figures, PG error objects (`detail` can contain row values), `TEMP` debug
  lines in `coinmarketcap.ts`.
- No Slack notifier exists anywhere (only a per-client `slackChannelKey` metadata field).
  `mcp-server` and `email-ingestion-gateway` each have their own JSON logger; the repo deliberately
  avoids cross-package runtime imports.

**Goal:** (1) a stable structured logger with a tagging scheme that says where every line came from,
(2) request / user / tenant correlation, (3) redaction by default, (4) pluggable sinks so an
external log service can be added later without touching call sites, (5) a separate typed Slack
notification hook for alerts and business events. Output stays on stdout (console) for now.

**Decisions**

- Slack: **two incoming webhooks** (alerts channel + events channel).
- Business events: **tenant created** and **invitation accepted**.
- Error alerts: **unexpected failures only** (crashes, failed jobs, DB pool trouble, masked resolver
  errors, quarantined email ingestions). `errorSimplifier` errors do **not** alert.
- Production: **Render, single instance** → in-process alert dedupe is sufficient (document the
  N-replica caveat). Output is platform-agnostic stdout JSON.
- `tenant.created` **may include the tenant (business) name** + ids. Never emails, tokens or Auth0
  ids.

## Design decisions

1. **`pino` 10.4.0 (exact) behind our own `Logger` facade.** Already resolved in `yarn.lock` (via
   fastify); `pino-pretty` is already the dev pipe.
   `yarn workspace @accounter/server add --exact pino@10.4.0` (lock diff: one extra descriptor on
   the same entry). Call sites only see our type; pino is importable only from
   `observability/logging` (ESLint-enforced at the end).
2. **Server-local** in `packages/server/src/observability/logging/` (+ `notifications/`), with no
   imports from server internals so it can be extracted to a shared package later. No new workspace
   package.
3. **Ambient context via `AsyncLocalStorage` + pino `mixin`, not DI.** The 419 call sites are free
   functions/resolvers; DI would change constructors and break hand-built injectors
   (`src/test-utils/ledger-injector.ts` throws on unknown tokens). Call sites use a module-level
   `const log = getLogger(import.meta.url)`. Identity is **pushed** into the store by
   `AuthContextProvider` once auth settles, so logging never triggers lazy auth/DB work.
4. **Output:** JSON lines on stdout; string `level`; ISO `time`; `msg` key (keeps `pino-pretty`
   zero-config and the documented pool-heartbeat shape valid). **Async**
   `pino.destination({ dest: 1, sync: false })` (sync mode busy-sleeps on EAGAIN and can freeze the
   event loop behind a slow pipe), with explicit `flushSync()` on the fatal/exit path and
   `log.fatal` (always flushSync). Pass the destination straight to `pino()` until a second sink
   exists; any future multistream entry must set `level: 'trace'`. Pretty output stays a dev-only
   pipe (`| pino-pretty`), no format knob.
5. **Notifications are a separate subsystem** (typed catalog, queue, dedupe). A log line never pages
   anyone implicitly, so migrating the 364 `console.error` sites cannot flood Slack.
6. **One failure → one log line → at most one alert**, enforced by a shared `WeakSet` of
   already-reported errors used by the Yoga logger adapter, `errorSimplifier` and the masking hook.
7. **Telemetry interaction:** trace correlation comes from **our own mixin only**
   (`trace.getActiveSpan()`; same API as `correlation-id-plugin.ts`).
   `@opentelemetry/instrumentation-pino` is bundled and on by default, so disable it explicitly in
   `telemetry/builder.ts` (see Wiring). Under `node --import` with no ESM loader it is probably
   inert, but a future loader would double-inject and forward every line to the SDK's default OTLP
   logger.

## Tagging scheme

Every line = pino base + `getLogger` bindings + ALS `mixin` (returns a **fresh object** each call;
pino mutates it).

| Field                                             | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service`, `env`, `release`                       | static base (`accounter-server`; `OTEL_DEPLOYMENT_ENV`→`NODE_ENV`; `RELEASE`). pid/hostname dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `module`                                          | derived by `getLogger(import.meta.url)` from the path: `…/modules/<dir>/…` → `<dir>` (works in `src/`, `dist/` which mirrors src, and vitest); other top-level dirs map to `plugins`, `jobs`, `telemetry`, `shared`, `observability`; explicit override object for infra scopes: `getLogger({ module: 'startup' \| 'shutdown' \| 'process' \| 'db' \| 'http', component })`. **Rule: directory name == log module.** A test walks `src/modules` to prove every dir resolves. Unknown `SERVER_LOG_LEVEL_OVERRIDES` keys → one startup `warn`. |
| `component`                                       | file name without extension (`charges.resolver`, `deel-client.provider`) or class name                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `event`                                           | optional stable dot-name (`db.pool.saturated`, `tenant.created`); required on alertable warn/error                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `requestId`                                       | UUID minted at the HTTP boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `correlationId`                                   | inbound `x-correlation-id` **only if** it matches `^[A-Za-z0-9._:-]{8,64}$`, else absent (same validation applied to the OTel span attribute)                                                                                                                                                                                                                                                                                                                                                                                                |
| `trace_id`, `span_id`, `trace_flags`              | own mixin, OTel-spec snake_case (documented exception to camelCase); `trace_flags` `00` = unsampled (head sampling is 0.5)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `operationName`, `authType`, `userId`, `tenantId` | ALS store; `operationName` from the parsed document only (GraphQL Name regex, ≤64 chars). `tenantId` = `AuthContext.tenant.businessId` (== owner id), omitted for the gateway identity (empty id).                                                                                                                                                                                                                                                                                                                                           |
| `err`                                             | top-level `err` key only (`error` aliased) → allowlist serializer (below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Field dictionary (documented): `chargeId`, `businessId`, `tenantId`, `transactionId`, `documentId`,
`userId`, `count`, `durationMs` — camelCase ids, never whole domain objects, never
emails/names/amounts/Auth0 ids.

Level policy: `fatal` process going down · `error` unexpected failure needing a human · `warn`
handled / degraded / auth rejection · `info` lifecycle + one access line per request + business
events · `debug` summaries · `trace` raw upstream payloads (clamped to `debug` in production).
Default `info`. Per-module overrides: `SERVER_LOG_LEVEL_OVERRIDES=deel=debug,db=warn`; every child
gets an explicit `{ level }`.

## Safety rules (from the security review — all testable)

- **Serializer = allowlist written from scratch** (std serializer copies every enumerable prop and
  folds cause messages into `message`). Emit `{type, code, statusCode, sqlState}`, PG
  `table/column/constraint/schema/severity/dataType`, scrubbed `message` ≤500 chars, ≤10 stack
  frames, causes as `[{type,code}]` (depth ≤3). Unwrap `GraphQLError.originalError` first; handle
  non-Error throwables; total function (try/catch, cycle guard, `SerializationFailed` fallback).
  Drop PG `detail/hint/where/internalQuery/parameters` and use a static message for SQLSTATE
  class 22. `upload-error.helper.ts` (which deliberately logs `where` and asserts it) opts in via an
  explicit collapsed, truncated `pgWhere` field. No `LOG_INCLUDE_PG_DETAIL` knob.
- **Redaction:** one array in `redaction.ts` generates explicit pino `redact` paths (path-anchored,
  bracket syntax for hyphenated keys: `req.headers["x-api-key"]`, `["x-gateway-cp-token"]`,
  `["x-dev-auth"]`, `x-business-scope`, cookie/set-cookie/proxy-authorization, `token`, `apiKey`,
  `apiToken`, `secret`, `password`, `invitationToken`, `access/refresh/id_token`, `client_secret`,
  `credentialsEncryptionKey`, `hiveToken`, `connectionString`, `err.config.headers.authorization`,
  …, nested variants enumerated, no `*`-first wildcards). pino 10 uses `@pinojs/redact`; it never
  touches `msg` or `err.message`, so a value-based `scrub()` (JWT, `Bearer …`,
  `hooks.slack.com/services/…`, emails) is applied to `msg`, error text and every Slack payload.
  `LogFields` is typed to reject `AuthContext` (plaintext token), `Environment`, `RawAuth`,
  `Request`. Table-driven test: each secret at depth 1–4, in `msg` and `err.message`.
- **Untrusted input:** facade-wide cap of 2000 chars per string field; access log records the
  **pathname only** (never query string/variables/body — `acceptInvitation(token)` variables are
  bearer credentials); one summary per request for errors (`errorCount`, `codes`), per-error lines
  only for unexpected errors, ≤5/request; auth rejections logged once per request as
  `{event:'auth.rejected', code}`.
- **ALS hygiene:** store holds primitives only (no request/context/injector);
  `withoutLogContext(fn)` (`als.exit`); long-lived things (notifier worker, timers, jobs) start in
  `main()` outside any store; `notify()` snapshots ids at enqueue time; borrower-owned listeners
  that log (`tenant-db-client.ts:428-437` pg `error`, `db-cleanup-plugin.ts:39-43` abort listener,
  `res` close handlers) are wrapped with `AsyncLocalStorage.bind`; singleton providers document
  "logs carry the first caller's context or none". Tests: two sequential requests on one pooled
  connection then `'error'` emit; notifier enqueued from request A has no `requestId` in worker
  lines.
- Production guards: clamp effective level to ≥`debug` unless `SERVER_LOG_ALLOW_TRACE=1`; raw
  upstream bodies logged only as `{status, bytes, contentType}`; log `fatal` + alert at startup if
  `ALLOW_DEV_AUTH=1` while the environment label is production (`auth-plugin.ts:36-40`; refusing to
  start is a follow-up decision).

## Architecture — new files

```
packages/server/src/observability/logging/
  index.ts        public API: getLogger, initLogging, flushLogs, runWithRequestContext, bindLogContext,
                  runWithLogContext, withoutLogContext, maskEmail, Logger/LogFields types
  config.ts       LoggingConfig, tolerant level/override parsing (pino throws on unknown levels)
  logger.ts       lazy facade + generation counter (see below), child cache, per-module levels
  context.ts      ALS store + mixin (ALS ids, then OTel ids; exactly one `trace_id` key)
  paths.ts        module/component derivation from import.meta.url
  redaction.ts    path list, scrub(), maskEmail
  serializers.ts  allowlist err serializer
  http.ts         withRequestContext(req, fn): requestId, validated correlationId, startedAt
  yoga-logger.ts  YogaLogger adapter
  sinks/index.ts  buildSinks(config); sinks/stdout.ts; sinks/external.ts (documented no-op hook)
  __tests__/
packages/server/src/observability/notifications/
  index.ts        notify(), alertError(), initNotifications(), flushNotifications(), getNotifierStats()
  events.ts       discriminated-union catalog (type, channel, severity, title, fields, fingerprint(), window)
  notifier.ts     Notifier interface, NoopNotifier (default until initNotifications)
  throttle.ts     LRU(500) fingerprint map, window TTL, suppressed-count flush, global cap
  slack/client.ts slack/queue.ts slack/format.ts
  __tests__/
packages/server/src/test-utils/capture-logs.ts   in-memory sink (excluded from dist by tsconfig.build.json)
packages/server/src/plugins/request-logging-plugin.ts
packages/server/scripts/notify-test.ts           `yarn workspace @accounter/server notify:test`
docs/architecture/logging.md   docs/operations/slack-notifications.md
```

**Lazy facade (required):** `getLogger()` runs at module scope, before `initLogging` (`index.ts`
awaits telemetry first), and pino children freeze level/destination/serializers/mixin. So
`getLogger` returns a facade holding a module-level `generation`; the root and children are rebuilt
on first use after any bump; `initLogging`, `captureLogs`, `resetLogging` bump it. The default root
reads `SERVER_LOG_LEVEL(_OVERRIDES)` from `process.env` tolerantly (fallback `info`). The logging
module **never imports `environment.ts`** (which `process.exit`s on invalid env and logs at `:322`);
`index.ts` calls `initLogging(env.log)` first.

### Public API

```ts
const log = getLogger(import.meta.url);                      // once per file
log.info({ event: 'deel.sync.completed', count }, 'Deel sync completed');
log.error({ err, chargeId }, 'Failed to update charge');     // fields first, then message; no printf variadics
runWithRequestContext(ctx, fn) / bindLogContext({ userId, tenantId, authType }) /
runWithLogContext({ tenantId }, fn) / withoutLogContext(fn)   // all no-ops without a store
notify({ type: 'tenant.created', … })                         // sync, never throws, returns void
alertError('job.failed', { err, job })                        // logs error + notifies
await flushNotifications(deadlineMs)
```

## Slack design

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
  `^\s+at ` lines only, fingerprint, `requestId`, `trace_id`, `correlationId` (mandatory — they are
  the pivot from Slack to the log line). `email-ingestion.quarantined`: `tenantId`, `reasonCode`,
  `auditId`, `correlationId` only. `tenant.created`: tenant name + `adminEntityId` + `createdBy`
  (local operator id). `invitation.accepted`: `businessId`, `roleId`, `userId`, `invitationId`.
  Never tokens, emails, Auth0 ids, SQL (`lastQuery`), subjects/filenames. `format.ts`: one
  `escapeMrkdwn()` (`&`,`<`,`>`) on every dynamic value before our own markup; the mention token is
  the only raw `<…>`; limits enforced (section ≤2900, ≤10 fields ≤1900, header ≤150 static, blocks
  ≤50, no empty text objects; truncate → escape → re-check); neutralize ``` in stacks; always send
  top-level `text` fallback. Golden tests: `<!channel>`, `<!subteam^X>`, `<https://evil|x>` inert.
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

### Hook points (line numbers from the review — re-verify while implementing)

| Event                         | Insertion point                                                                                                                                                                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant.created`              | `AdminOnboardingProvider.bootstrapNewClient` (`modules/onboarding/providers/admin-onboarding.provider.ts:88-316`): `const result = await this.db.transaction(…)` then `notify()`; operator from `requireSuperAdmin()` (`:89`) | Fire **once, only on first creation, only after a successful COMMIT.** `TenantAwareDBClient.endSession` swallows COMMIT failure (`tenant-db-client.ts:470-481`) and bootstrap is idempotent (`:106`), so add `onCommitted(cb)` to `TenantAwareDBClient` (callbacks run only after outermost successful COMMIT, discarded on rollback) and derive `isNew` inside the tx (business-user insert `ON CONFLICT DO NOTHING RETURNING`, `:271-276`); re-bootstrap emits log-only `tenant.reinvited`. Auth0 `createBlockedUser` (`:268`) is inside the tx and not rolled back — document. |
| `invitation.accepted`         | `invitations.resolver.ts` right after `await acceptInvitation(…)` returns (COMMIT is `accept-invitations.provider.ts:239`), outside the try that maps to `INVITATION_ACCEPT_FAILED`                                           | ids only (business name not available without an RLS-pinned query). Also add `log.error` in that resolver's catch (`:136-144`), which swallows the cause.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `server.crashed`              | `index.ts:250-259` handlers                                                                                                                                                                                                   | See "Crash path". SIGINT/SIGTERM never alert.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `job.failed`                  | `index.ts:128-130` (single alert site; also when `result.errors > 0` — per-invitation failures are only counted, `cleanup-expired-invitations.ts:79-82`)                                                                      | `jobs/utils.ts:40-42` becomes log-only (+ `warn` for the silent overlap skip `:33-35`). `run-cron-jobs.helper.ts:92-96` is a user-triggered mutation stream → log-only, pass `tenantId` explicitly.                                                                                                                                                                                                                                                                                                                                                                               |
| `db.pool.saturated`           | `pool-monitor.ts:50-52`                                                                                                                                                                                                       | Alert only on `waitingCount > 0` for 2 consecutive ticks (`saturated` at `:32` also fires for busy-not-wedged); re-notify 15 min then 1 h; one "recovered" message. Heartbeat keeps `msg:'db-pool-heartbeat'`, nested shape, `level:'error', saturated:true`.                                                                                                                                                                                                                                                                                                                     |
| `db.connection.leaked`        | `index.ts:80-90` `onLeak`                                                                                                                                                                                                     | exclude `lastQuery` from Slack (truncated in the log only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `graphql.internal-error`      | `createYoga({ maskedErrors: { maskError } })` wrapper in `index.ts`                                                                                                                                                           | See "GraphQL errors".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `email-ingestion.quarantined` | wrap public `performIngest` (`email-ingestion-ingest.provider.ts:261`) in `runWithLogContext({tenantId})` and notify only when `result.outcome === QUARANTINED`                                                               | Never inside `recordNonInsert` (`:690-732`) or any `withTenantContext` callback (re-run on a dead connection, pre-COMMIT); never for IGNORED/SELF_ISSUED (`:334-355`).                                                                                                                                                                                                                                                                                                                                                                                                            |

## Wiring changes in existing code

- **`src/index.ts`**: register `uncaughtException`/`unhandledRejection` + `main().catch(fatal)` as
  the **first statements of `main()`**; `initLogging(env.log)` and `initNotifications(env.slack)`
  next; replace all `stderr/stdout.write`, the Auth0 `console.log`s and the inline `Logger`;
  `createServer((req, res) => withRequestContext(req, () => yoga(req, res)))` (`als.run`);
  `createYoga({ logging: yogaLogger, maskedErrors: { maskError } })`; warn inside the readiness
  check callback (`:157-165`, Yoga swallows it). Plugin order:
  `correlationId → requestLogging → dbCleanup → auth → useGraphQLModules → useSchema → defer → hive → readiness`
  (no separate error plugin).
- **Crash path (the draft's flush was unreachable — `server.close()` is awaited before the
  force-exit timer is armed, `:195-208`):** fatal path = `log.fatal` (flushSync) → arm an absolute
  ~8 s deadline **before** `server.close` → enqueue `server.crashed` on the priority lane →
  `Promise.allSettled([flushNotifications(remaining), server.close()])` → `process.exit` in
  `finally`. A second fault during shutdown is logged (today `:185` drops it). The final request's
  timeout is the remaining budget. Consider awaiting `yoga.dispose()`. Tests: hung `server.close`
  and hung `pool.end` → exactly one POST attempt, exit within budget.
- **GraphQL errors:** `maskError` wrapper calls Yoga's exported `maskError`, and when the result
  `!== original` (masked = unexpected) or the error is a deliberate
  `extensions.code === 'INTERNAL_SERVER_ERROR'`, calls `reportUnexpected(err)` (alert only; skips
  aborted requests / Abort/Timeout causes). Parse/validation errors never alert; code-less
  `GraphQLError`s (≈420 sites, plus every `errorSimplifier` result) do not alert — the old "code
  absent" predicate would have. The Yoga adapter is the single log line (Error-like first arg →
  `log.error({err})`; string first arg → `log[level](attrs ?? {}, msg)`); Yoga's chatter
  ("Processing GraphQL Parameters") is `debug`, so it disappears at `info`.
- **`requestLoggingPlugin`:** read `startedAt` from the ALS store (Yoga's `/health`, CORS, GraphiQL
  handlers run before user plugins); `onParams` sets `operationName`; one line from `onResponse`
  (status, `durationMs`, `operationName`, `errorCount`, `unexpectedErrorCount`;
  `res.once('close', AsyncLocalStorage.bind(…))` for SSE/defer); skip successful
  `/health`,`/ready`,`/readiness`; whole body in try/catch (a plugin throw becomes a 500 with the
  stack); keep a `debug` "request started" line (the db-pool runbook looks for it). Fallback for
  tests that call `yoga.fetch()` directly: wrap in `als.run` inside `onRequest` and stash the store
  in a `WeakMap<Request,Store>`.
- **`AuthContextProvider`** (`auth-context.provider.ts`): private `settle(ctx)` called at the four
  success cache points (devBypass `:267-269`, apiKey `:289-291`, gateway `:412-413`, jwt `:501-503`)
  after scoping → `bindLogContext({ authType, userId, tenantId: businessId || undefined })`. Not in
  `applyRequestedReadScope` (gateway skips it; it can throw). No `AdminContextProvider` binding
  (`ownerId === tenant.businessId`). Fix the raw `auth0UserId` warn at `:475`. Email-ingestion:
  `runWithLogContext({tenantId})` inside `withTenantContext`/`withPoolReadRetry` and around
  `performIngest`.
- **`shared/errors.ts` `errorSimplifier`:** signature unchanged. Non-`GraphQLError` branch →
  `log.error({err}, message)` with module/component derived from the caller frame
  (`Error.captureStackTrace`, first non-`shared` frame; error path only), error added to the
  reported-WeakSet; pass-through `GraphQLError`s log at `warn`.
- **`telemetry/builder.ts` (+ `builder.test.ts` assertions):**
  `'@opentelemetry/instrumentation-pino': { enabled: false }`;
  `'@opentelemetry/instrumentation-undici': { ignoreRequestHook: r => r.origin === 'https://hooks.slack.com' }`
  (it records `url.full`, and the webhook URL is a bearer secret). NodeSDK 0.223 registers default
  OTLP logs/metrics exporters when `OTEL_ENABLED=1`; document it and optionally pass
  `logRecordProcessors: []` / `OTEL_LOGS_EXPORTER=none`.
- **`pool-monitor.ts`**, **`jobs/*`**: heartbeat via logger with the exact existing key set (test
  pins it). Jobs keep their local `Logger {info(message, meta), error(message, meta)}` interface (8
  test injection sites); one shared `fromMessageMeta(log)` adapter replaces the two inline copies;
  `{ error }` keys → `{ err }`; the CLI script stays log-only.
- **`environment.ts`:** `LogModel`/`SlackModel` after `OtelModel` (`:240`) using `emptyString(...)`,
  registered in `configs` (`:299-310`), `env.log`/`env.slack` after `otel:` (`:406-421`). Variables:
  `SERVER_LOG_LEVEL` (enum incl. `silent`), `SERVER_LOG_LEVEL_OVERRIDES`, `SERVER_LOG_ALLOW_TRACE`,
  plus the Slack set above. **Not** `LOG_LEVEL`: `@graphql-hive/logger` (via `useHive`) may read it
  and throws on unknown values. Update both `.env.template`s (server Observability block after
  `:81`, root after `:121`), `packages/server/README.md:98-149`.
- **Tests:** `scripts/vitest-setup.ts` and `scripts/vitest-global-setup.ts` set
  `process.env.SERVER_LOG_LEVEL ||= 'silent'` (`||=`: CI sets blanks) and delete `SLACK_*`;
  `captureLogs()` builds its own logger with an explicit level. Console-asserting tests to migrate
  with their module: `upload-error.helper.test.ts:61-66,131`, `clients.helper.test.ts:55-61`,
  `email-ingestion-ingest.provider.test.ts:856,874`,
  `dynamic-report-snapshots.integration.test.ts:534-543`, `pcn.helper.test.ts:1052-1075`.
  `environment*.test.ts` and `telemetry/__tests__/index.test.ts` stay on console. Silence-only spies
  are deleted (`auth0-management.test.ts:147`, `accept-invitations.provider.test.ts:435`,
  `dynamic-report-comments.*:454/109`, `vat-report-summary.resolver.test.ts:333`,
  `pcn.helper.test.ts:651/666/712`). Env tests go in `src/environment-logging.test.ts` (so they run
  under `yarn test`; `src/__tests__/**` is integration-only).
- **Changesets:** each PR touching `packages/**` needs a hand-named `.changeset/<kebab>.md`
  (`'@accounter/server': minor|patch`); the auto-generated `@accounter_server-<n>-dependencies.md`
  does not satisfy `require-changeset.yml`.

## Migration plan (small, independently revertible PRs; squash-merge; `yarn lint` + `yarn generate` before each)

| PR    | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Fix the stale module list in `packages/server/CLAUDE.md` (reality: 37 dirs, 35 registered; `priority` / `workspace-settings` don't exist — verify); introduce the per-directory `no-console: error` ratchet (each sweep PR adds its directories).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1a    | Logging core + day-0 spikes (below) + `docs/architecture/logging.md` skeleton. **No call-site changes.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1b    | Notifications core (Noop + Slack client/queue/format/throttle, injected `fetch`), env models + tests, `notify:test`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2a    | Infra logs: `index.ts` startup/shutdown/process handlers, crash path, pool-monitor, jobs, `onLeak`; update `db-connection-pool.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2b    | ALS `withRequestContext` + `requestLoggingPlugin` + correlation-id validation; **console shim** routing un-migrated `console.*` through the logger as `module:'legacy-console'` (gains requestId/tenantId/redaction, JSON-escaped; removed in the final PR).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2c    | `AuthContextProvider.settle()` binding + email-ingestion `runWithLogContext`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2d    | Yoga adapter + `maskError` hook + `errorSimplifier` + reported-WeakSet + `builder.ts` changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3a    | `onCommitted` + `tenant.created` + `invitation.accepted` (+ `docs/operations/slack-notifications.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3b    | Infra alerts: `server.crashed`, `job.failed`, `db.pool.saturated`, `db.connection.leaked`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3c    | `graphql.internal-error` + `email-ingestion.quarantined`. Optional, **default off**: a ≤1-per-30-min digest of top-5 `errorSimplifier` call-site keys (`SLACK_SIMPLIFIED_DIGEST_THRESHOLD`), always counted in the heartbeat — surfaces systemic failures without reversing the "unexpected only" decision.                                                                                                                                                                                                                                                                                                                                                                                            |
| 4a    | Pilot sweep of 2–3 small modules (tags, contracts, misc-expenses) to validate the codemod.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4b    | Critical modules: `auth`, `email-ingestion`, `scraper-ingestion`, `app-providers` (delete `coinmarketcap.ts` TEMP lines; Deel raw bodies → `{status, bytes, contentType}`; `[db]` lines in `tenant-db-client.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5…    | Sweeps by descending call count (documents, charges, business-trips, financial-entities, ledger, reports, deel, rest). Each migrates its asserting tests in the same PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Final | Remove console shim; `no-console: error` for `packages/server/src/**` with allowlist (`environment.ts` (tests assert it), `bootstrap-telemetry.ts`, `telemetry/index.ts:34,61,63`, `demo-fixtures/**`, `scripts/run-invitation-cleanup.ts`; `@whatwg-node/server` still writes raw `console.error` internally — documented); `no-restricted-imports` for `pino` layered before `eslint.config.mjs:354`, extended into `:354-373`, `'off'`→error in `:375-397`, off only for `observability/logging/**` + `test-utils/**`; remove the 3 stale `eslint-disable no-console`; `packages/server/CLAUDE.md` + `.claude/rules` "Logging" cheat-sheet; fix `docs/user-providers-credentials/blueprint.md:616`. |

**Transform rules for sweeps** (one-off `tsx` script on the TypeScript compiler API, no new deps;
estimate ≈40% mechanical / 20% semi / 40% human, so every diff is reviewed; splice by node range
then prettier; leave bare `console.error(e)` (67) and `JSON.stringify(e)` (13) for a human; watch
expression-body `.catch(e => console.error(e))` and orphaned catch params): `console.error(e)` /
`(msg, e)` / `` `${msg}: ${e}` `` → `log.error({ err: e }, '<what failed>')` (always add a
description); interpolated ids → structured fields; `console.log` → `info`/`debug` by policy; delete
rather than migrate `documents/resolvers/common.ts:33,40` (per-document log in list queries), the
`TEMP` lines, and the reserve "prompt" dumps (`vacation-reserve.helper.ts:215`,
`recovery-reserve.helper.ts:270`); aggregate per-record debug lines (`pcn.helper.ts:86,238`); guard
expensive debug payloads with `isLevelEnabled`; never log whole charge/document/contract/payroll
objects.

## Day-0 spikes (PR 1a — record outcomes in `docs/architecture/logging.md`)

`import { pino } from 'pino'` under the real ESM build with tsc 6 · `pino-pretty` with string levels
(`-L/--minimumLevel` and `{levelLabel}` don't work with them) · backpressure:
`node app | (sleep 5; cat)` with 100k lines, measure event-loop delay · ALS inside
`@defer`/`@stream`/SSE resolvers after the first payload, with a keep-alive second request ·
`OTEL_ENABLED=1`: in-request lines carry `trace_id`, no POST to `<endpoint>/v1/logs` · whether
`useMaskedErrors` leaves `incremental[].errors` unmasked · whether `useHive` builds its own logger
or uses `yoga.logger` (pass the adapter explicitly) · **Render staging:** how `level` / `msg` /
`fatal` render (if `message` is required, set pino `messageKey:'message'` and pino-pretty
`--messageKey message`, keeping the pool heartbeat doc consistent).

## Future external log service (prepared, not built)

`sinks/index.ts` takes `SERVER_LOG_SINKS=stdout,…` (default `stdout`); `sinks/external.ts` documents
the contract: add one file exporting an in-process stream or a **single** `transport:{target}` —
never `transport.targets` (pino throws when combined with the string-level formatter); every
multistream entry at `level:'trace'`; sink errors isolated (never crash the process) with a
backpressure policy; redaction/serialization always happen before any sink; third-party transports'
string-level support must be tested first. A golden record-contract test pins the keys of a
representative line (`level`, `time`, `msg`, `service/env/release`, `module/component`, `requestId`,
…). `docs/architecture/logging.md` carries a delta table vs `mcp-server`/gateway (`message` vs
`msg`, `timestamp` vs `time`) and a data-handling section (stores: host logs, Slack channels, Tempo;
retention; "never log" dictionary). Candidate backend: OTLP logs → Grafana Loki (Tempo is the trace
backend; Loki derived field on `"trace_id":"(\w+)"`). Require a processor/DPA/region review before
any external sink lands.

## Out of scope / follow-ups

GraphQL alias/depth/token limit plugin (none today; Yoga's default body cap is 25 MB — limits
unauthenticated log/alert amplification, track before PR 3 goes live) · refusing to start with
`ALLOW_DEV_AUTH=1` in production · Slack on migration failure (`packages/migrations` has its own env
module) · scraper failures (run in the user's local `scraper-app`) · Sentry · aligning
`mcp-server`/gateway field names · an external uptime check on `/health` and `/ready` (Slack cannot
report OOM/SIGKILL, event-loop hangs, invalid env at import, or failed deploys — stated in the
runbook).

## Verification

- Per PR: `yarn workspace @accounter/server typecheck`, `yarn lint`, `yarn prettier:check`,
  `yarn test`, `yarn test:integration` (Postgres + migrations up), `yarn generate`.
- Unit tests: redaction table (depth 1–4, in `msg` and `err.message`); hostile serializer fixtures
  (jose `JWTExpired` with email payload, Auth0 `Body`, `APICallError`, throwing `message` getter,
  cause cycle, 1 MB message, non-Error throwables); level-override parsing; lazy facade (`getLogger`
  → `initLogging` → assert level/destination changed); ALS propagation across `await`, timers,
  DataLoader batches, nested `runWithLogContext`, `@defer`/`@stream`, pooled-connection `'error'`
  emit; mixin (valid / invalid / absent span; exactly one `trace_id` key; no duplicate JSON keys);
  `getLogger` module derivation incl. a walk of `src/modules`; Slack formatter goldens (limits,
  mention inertness), queue (timeout, 429, overflow, per-URL spacing), throttle (fake timers; 10,000
  distinct messages keep the map ≤500), crash path (hung `server.close` / `pool.end`), notifier
  never throws / never causes `unhandledRejection` (sync-throwing fetch, rejected fetch, stream
  error, throwing formatter, BigInt/circular field), webhook URL never present in any
  log/error/payload (runtime-built fake URL), `builder.test.ts` assertions, heartbeat key-set pin.
- Integration: real `createYoga` with the plugins + `captureLogs()` — a query with
  `x-correlation-id` yields one access line carrying `requestId/correlationId/userId/tenantId`; a
  plain `Error` in a resolver yields exactly one error log line and exactly one alert; a
  `createGraphQLError` with `FORBIDDEN` yields none; `tenant.created` fires once on first bootstrap,
  zero on re-run, zero on simulated COMMIT failure / rollback; `invitation.accepted` fires once;
  `QUARANTINED` vs `IGNORED`. Use a plain `Error` for the unexpected case and `createGraphQLError`
  for expected ones (vitest graphql dual-package artifact, `upload-error.helper.ts:139-143`).
- Manual: `yarn local:setup`, `yarn workspace @accounter/server dev` → hit `/graphql`, check
  pretty + raw JSON; `kill -TERM` flush; real Slack test-workspace webhooks for both channels (does
  a mention inside a Block Kit mrkdwn section notify; status for a revoked webhook / archived
  channel; over-limit blocks → 400); `rg "console\.(log|info|warn|error|debug)" packages/server/src`
  returns only the allowlist.
