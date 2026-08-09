# MCP Server — Operations Runbook

Operational reference for the `@accounter/mcp-server` remote connector (phase 1, read-only). Scope
is limited to behavior actually implemented in `packages/mcp-server`.

## 1. Service overview

- **Process**: a single Node HTTP server (`packages/mcp-server/src/server.ts`), started via
  `src/index.ts`. Stateless — no database of its own; all data comes from the Accounter GraphQL
  server over HTTP.
- **Endpoints**:
  - `GET /health` — liveness/readiness (no auth).
  - `GET /metrics` — in-process telemetry snapshot (JSON, no auth).
  - `GET /.well-known/oauth-protected-resource` — RFC 9728 discovery (no auth).
  - `GET|POST /mcp` — MCP transport (JSON-RPC 2.0), bearer-authenticated.
- **Kill-switch**: `MCP_ENABLED=0` disables only the MCP transport (`/mcp`) and its OAuth metadata
  route (both return `404`); `/health` and `/metrics` stay available.
- **Shutdown**: `SIGINT`/`SIGTERM` drains connections, then exits (forced after a grace period).

## 2. Key metrics (`GET /metrics`)

Labels never carry PII — only tool names, outcome classes, and error categories.

| Metric                | Shape                                                                 | Watch for                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestsTotal`       | counter keyed `"<tool>\|<outcome>"`                                   | Rising `*_error` outcomes; ratio of `success` to errors per tool.                                                                                                                                             |
| `latencyMs`           | histogram (per-bucket counts + count/sum)                             | p95/p99 drift; `sum/count` mean latency creeping up.                                                                                                                                                          |
| `authFailuresTotal`   | counter by reason (`missing_token`, `expired_token`, `invalid_token`) | `expired_token` = live tokens aging out (clients should refresh); `invalid_token` = bad signature/issuer/audience → misconfig or abuse; a burst of `missing_token` = clients reconnecting (tokenless probes). |
| `upstreamErrorsTotal` | counter by category                                                   | Sustained `TIMEOUT_ERROR`/`UPSTREAM_ERROR` → upstream health issue.                                                                                                                                           |
| `rateLimitedTotal`    | counter                                                               | Sustained growth → limits too tight or a hot client.                                                                                                                                                          |

Baseline latency targets and the load profile are captured by
`packages/mcp-server/src/__tests__/perf.test.ts` (`yarn workspace @accounter/mcp-server benchmark`).

## 3. Logs

Structured JSON, one object per line. Every request carries `requestId` and `correlationId` (the
latter inherited from an inbound `X-Correlation-Id` header when present, and echoed on the
response + propagated upstream). Secrets and `Authorization` headers are never logged.

Request logs carry extra fields that make idle/cold-start/disconnect symptoms diagnosable:

- **`msSinceLastRequest`** (on `request started`) — gap since this process last saw a request.
  Absent on the first request of a process, which — paired with a fresh `mcp server started` line
  (now tagged with `pid`) — is the cold-start signal.
- **`aborted` / `responseCompleted`** (on `request completed`) — `aborted: true` means the client
  hung up before the response finished, the server-side fingerprint of a client-side timeout (e.g. a
  request abandoned while the instance was cold starting).
- **`uptimeSeconds`** (on `request completed`) — process uptime; values that keep resetting to
  near-zero across requests reveal an instance that is restarting/spinning down rather than staying
  warm.
- **`category`** (on `access token verification failed`) — `missing_token` / `expired_token` /
  `invalid_token`, matching the metric buckets.

Useful queries (adapt to your log backend):

- **Trace one request across hops**: filter by `correlationId == "<id>"` (spans MCP → GraphQL).
- **Auth failures**: `message == "access token verification failed"` (carries `reason` + `category`,
  never the token). Tokenless probes (`category == "missing_token"`) are now logged too — previously
  they were silent.
- **Cold starts / spin-downs**: `message == "mcp server started"` (one per process start), or
  `request completed` where `uptimeSeconds` is small, or `request started` with a large
  `msSinceLastRequest`.
- **Client-side disconnects**: `request completed` where `aborted == true`.
- **Upstream failures**: `message` starting `span end` with `name == "upstream:graphql"` and a
  non-zero error, or tool results logged with `code` in (`UPSTREAM_ERROR`, `TIMEOUT_ERROR`).
- **Slow requests**: completion logs where `latencyMs` exceeds your target.
- **Unexpected tool errors**: `message == "unexpected error during tool execution"` (carries `tool`,
  `correlationId`, and the sanitized error) — these map to `INTERNAL_ERROR` for callers.

## 4. Incident playbooks

### A. Elevated `401`s / all calls failing auth

1. Check `authFailuresTotal` split: `missing_token` vs `expired_token` vs `invalid_token`.
2. `invalid_token` spike → verify `AUTH0_ISSUER_URL` and `AUTH0_AUDIENCE` match the tokens clients
   present, and the tenant JWKS is reachable. A JWKS outage surfaces as a `5xx` (not `401`).
3. `expired_token` spike → tokens are aging out faster than clients refresh; the transport still
   answers `401 invalid_token` (RFC 6750), but the metric is bucketed as `expired_token`. Check the
   Auth0 access-token lifetime and that clients hold a working refresh token.
4. A `missing_token` spike with prompt recovery (a `401` immediately followed by a
   `/.well-known/oauth-protected-resource` fetch and a `200`) is the normal reconnect handshake, not
   an incident.

### B. Elevated `UPSTREAM_ERROR` / `TIMEOUT_ERROR`

1. Check the Accounter GraphQL server health and network path (`GRAPHQL_UPSTREAM_URL`).
2. Timeouts are bounded-retried; persistent 5xx exhaust retries then surface as errors. Consider
   raising `GRAPHQL_UPSTREAM_TIMEOUT_MS` only if the upstream is legitimately slow.
3. 4xx/GraphQL-level errors are **not** retried — investigate the upstream, not the connector.

### C. Elevated `RATE_LIMIT_ERROR`

1. Inspect `rateLimitedTotal` and the offending `{user, scope, tool}` pattern in logs.
2. Adjust `MCP_RATE_LIMIT_CONFIG` (`{"windowMs":60000,"max":60}` default) if limits are too tight.

### D. Suspected data-exposure / tenant-isolation concern

1. Treat as high severity. **Flip the kill-switch**: set `MCP_ENABLED=0` and restart — `/mcp` and
   its metadata route return `404` (`/health` and `/metrics` stay up).
2. Memberships are resolved server-side from `business_users` via `myMemberships`; scope narrowing
   outside memberships is denied (`AUTHORIZATION_ERROR`). Verify the server-side rows and the
   caller's token.

### E. Client connection "dies" / requires manual re-auth after idle

Symptom: a connected Claude client (Desktop/claude.ai) that was working goes dead after a period of
inactivity (e.g. overnight) and only recovers when the user manually reconnects.

**First conclusion to reach for: hosting, not auth.** The connector is stateless and does not hold a
session — an idle timeout or redeploy cannot evict server-side session state, because there is none.
The observed cause of this symptom (investigated Aug 2026) was an **idle-spin-down host**: the
instance slept after 15 minutes with no requests and cold-started (~15s) on the next one. Because
MCP Streamable HTTP is request/response, the client sends nothing between prompts, so **the client
cannot keep the instance warm** — any gap in user activity guarantees a spin-down, and the first
request after the gap hits a cold boot. If that request exceeds the client's timeout it fails
client-side (a `499`/abort at the edge, not a `5xx` the app logs), and the client marks the
connector disconnected.

Diagnosis checklist:

1. **App logs** — is there a `SIGTERM` / `shutdown` roughly 15 min after the _last_ request, then a
   later `mcp server started` (new `pid`)? That cadence is idle spin-down. `POST /mcp` requests that
   land after a gap show a large `msSinceLastRequest`; a restarting instance shows small
   `uptimeSeconds`.
2. **Platform edge logs** (e.g. Render → Logs, `type: request`) — `502`/`503` during boot windows,
   or `499`/timeouts on `POST /mcp` when the user returned, confirm requests failing at the edge
   while the instance was unavailable. The app cannot log a request it never received.
3. **Auth is a red herring here unless** `authFailuresTotal.expired_token` / `invalid_token` is
   actually rising, or Auth0 logs show failed refresh (`type: fer`/`fert`). A lone `missing_token`
   401 that immediately recovers via `/.well-known/oauth-protected-resource` → `200` is the _normal_
   reconnect handshake, not a failure.

**Fix: keep the instance always-on.** Run the connector on a hosting tier that does not spin down on
idle (preferred), or keep it warm with an external pinger hitting `GET /health` more often than the
idle window (`/health` needs no auth). Ensure health-check-gated / zero-downtime deploys so
redeploys don't drop in-flight requests. Token refresh, `401` handling, and statelessness are all
functioning; the hosting tier is the lever.

## 5. Rollback

- **Fastest mitigation**: `MCP_ENABLED=0` (kill-switch) — disables the connector while keeping the
  process/health up. No redeploy needed if env can be changed and the process restarted.
- **Version rollback**: redeploy the previous image/build of `@accounter/mcp-server`. The service is
  stateless, so rollback is safe and requires no data migration.

> **Note:** `MCP_TOOL_ALLOWLIST` is enforced (#4104) and can be used to disable a single misbehaving
> tool without taking the connector down: set it to the tools you want to keep. **An empty value
> means no restriction**, not "no tools" — to disable everything, use the kill-switch. Changing it
> requires a process restart, and any allowlist you set should include `accounter_list_businesses`
> or business discovery is lost.

## 6. Configuration reference

See [`packages/mcp-server/README.md`](../README.md#configuration) for the full env-var table.
Required: `MCP_PUBLIC_BASE_URL`, `AUTH0_ISSUER_URL`, `AUTH0_AUDIENCE`, `GRAPHQL_UPSTREAM_URL`. The
process fails fast at startup on any missing/malformed value.
