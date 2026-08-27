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
| `labeledTotals`       | counter keyed `<counter> -> <label>`                                  | Tool-contributed usage counters (see below). `__other__` growing means a counter hit its label cap.                                                                                                           |

Baseline latency targets and the load profile are captured by
`packages/mcp-server/src/__tests__/perf.test.ts` (`yarn workspace @accounter/mcp-server benchmark`).

### 2.1 Usage counters (`labeledTotals`)

Tools contribute low-cardinality label counters through their `observe` hook. These answer product
questions about how the connector is actually being used, not operational ones:

| Counter                  | Label                           | Answers                                                         |
| ------------------------ | ------------------------------- | --------------------------------------------------------------- |
| `glossary_term_requests` | canonical glossary term         | Which terminology callers look up most (≤62 labels).            |
| `glossary_term_misses`   | folded, 40-char-clipped request | Terms callers asked for that the glossary does not define yet.  |
| `glossary_mode`          | `index` \| `full`               | Browse-the-index-first vs. direct lookup.                       |
| `document_upload_source` | `urls` \| `inline`              | Whether uploads arrive as links or as base64 through the model. |

```bash
curl -s "$MCP_BASE_URL/metrics" | jq '.labeledTotals'
```

`document_upload_source` is the one to watch after a change to the upload tool's description:
`inline` is capped at 256KB per file because that content rides in the model's own output, so a
rising `inline` share means callers are still hitting a ceiling that `documentUrls` removes
entirely.

Two caveats before you read anything into these numbers:

- **Per process, and reset on restart.** These are in-memory counters, so a redeploy or a spin-down
  zeroes them and a multi-instance deployment splits them. Treat them as a live sample; the log
  stream is the durable record.
- **`/metrics` is unauthenticated, while calling a tool requires a valid token.**
  `glossary_term_misses` labels are therefore caller-supplied text that is publicly readable. They
  are folded, clipped to 40 characters, and capped at `MAX_COUNTER_LABELS` distinct labels per
  counter (further new labels land in `__other__`), which bounds this to junk vocabulary rather than
  data — the glossary tool is classified `public` and touches no customer data. Worth closing when
  `/metrics` gets gated.

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

### 3.1 Handshake logs (`event: "mcp_initialize"`)

Every `initialize` emits one line. This is the only record of _which client_ is talking to the
connector — a remote client's handling of tool results can change without anything in this repo
changing, and when that happened once, dating it required the client's own local logs.

| Field                      | Meaning                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `clientName`               | `clientInfo.name` as the client reported it, clipped. `null` if it sent none.                                                    |
| `clientVersion`            | `clientInfo.version`, clipped. **The field that dates a client-side behavior change.**                                          |
| `requestedProtocolVersion` | The MCP revision the client asked for. `null` if absent.                                                                         |
| `servedProtocolVersion`    | What this server answered — currently unconditional.                                                                             |
| `protocolVersionMismatch`  | Client asked for a revision this server does not implement. The one field worth alerting on. `false` when nothing was requested. |
| `clientCapabilities`       | Capability _names_ only, sorted. Values are unbounded and caller-supplied.                                                       |
| `userId` / `correlationId` | Same meaning as on `tool_call`, so a session can be joined across both events.                                                   |

Caller-derived fields are merged beneath the canonical ones, so `clientName` and friends can never
overwrite `userId`, `correlationId`, or `event`. A handshake the server cannot parse still logs a
line, with the unparseable fields `null`.

### 3.2 Tool-call usage logs (`event: "tool_call"`)

Every completed tool call emits exactly one line with `event: "tool_call"` — including calls
rejected by validation, policy, or the rate limiter, which never reach a handler. This is the only
per-tool record: every MCP call is the same `POST /mcp`, so the
`request started`/`request completed` pair cannot tell one tool from another.

`event` is the stable discriminator to select on; prefer it over matching the free-text `message`.

Common fields:

| Field                                        | Meaning                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tool`                                       | Registered tool name.                                                                                                                                                                                                    |
| `outcome`                                    | Same label set as the `requestsTotal` metric (`success`, `validation_error`, …).                                                                                                                                         |
| `latencyMs`                                  | End-to-end time inside the executor.                                                                                                                                                                                     |
| `userId`                                     | Auth0 subject of the caller.                                                                                                                                                                                             |
| `correlationId`                              | Ties the call to its request and to the upstream GraphQL hop.                                                                                                                                                            |
| `businessScopeSize`                          | Businesses in the resolved read scope. Present once the policy resolved a scope, **including a rate-limited call** (scope is resolved before the limiter runs); absent only for a validation or authorization rejection. |
| `returnedCount` / `totalCount` / `truncated` | Result size, for any tool using the shared list shaping.                                                                                                                                                                 |

Glossary-specific fields (`accounter_explain_terminology`), which are the readable signal of what a
caller was trying to do before they knew how to ask for data:

| Field                | Meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `glossaryMode`       | `index` (asked what exists) or `full` (asked what something means).             |
| `requestedTerms`     | Verbatim spellings the caller used, e.g. `valueDate`.                           |
| `matchedTerms`       | Canonical terms those resolved to, e.g. `value-date`.                           |
| `missedTerms`        | Requested terms the glossary does not define — the backlog of entries to write. |
| `requestedTopics`    | Topics asked for in full.                                                       |
| `requestedTermCount` | Number of terms explicitly named (`0` in index mode and for topic-only calls).  |

Note that terms pulled in by `topics` are deliberately **not** counted as requested — a
`topics: ["charge"]` call returns every charge entry, and crediting each one would turn
"most-requested term" into a measure of topic breadth.

Write-tool fields. Every write also emits a **separate** `mutating tool invoked` audit line
(`audit: true`) _before_ its handler runs, carrying the affected record ids; the fields below are
the complement to it, recorded _after_ the call and saying what actually applied. Neither line ever
carries document content, filenames, or URLs — a signed download link carries an access token:

| Field                                         | Tool                            | Meaning                                                                                  |
| --------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `documentSource`                              | `accounter_upload_documents`    | `urls` (server fetched them) or `inline` (base64 through the model).                     |
| `requestedDocumentCount`                      | `accounter_upload_documents`    | Documents named in the call.                                                             |
| `uploadedCount` / `failedCount`               | `accounter_upload_documents`    | Per-file outcome — upstream reports success per document, so a batch can partially fail. |
| `requestedChargeCount` / `updatedChargeCount` | `accounter_update_charges_tags` | Charges asked for vs. actually updated. A gap means ids that upstream could not resolve. |
| `addedTagCount` / `removedTagCount`           | `accounter_update_charges_tags` | Size of each direction of the edit.                                                      |

Extraction recipes (pipe your platform's log stream in; `jq -c` on a file works the same):

```bash
# Most-requested glossary terms
jq -r 'select(.event=="tool_call") | .matchedTerms // [] | .[]' logs.jsonl \
  | sort | uniq -c | sort -rn

# Terms callers asked for that the glossary is missing — the content backlog
jq -r 'select(.event=="tool_call") | .missedTerms // [] | .[]' logs.jsonl \
  | sort | uniq -c | sort -rn

# Which tool a caller reached for after a glossary lookup, in order
jq -r 'select(.event=="tool_call") | [.userId, .tool, (.matchedTerms // [] | join(","))] | @tsv' \
  logs.jsonl

# Uploads still taking the size-capped base64 path, by caller
jq -r 'select(.event=="tool_call" and .documentSource=="inline") | .userId' logs.jsonl \
  | sort | uniq -c | sort -rn

# Tag updates that silently skipped charges (asked > updated)
jq -r 'select(.event=="tool_call" and .updatedChargeCount != null
  and .updatedChargeCount < .requestedChargeCount)
  | [.correlationId, .requestedChargeCount, .updatedChargeCount] | @tsv' logs.jsonl

# Tool popularity and error rate
jq -r 'select(.event=="tool_call") | "\(.tool)\t\(.outcome)"' logs.jsonl \
  | sort | uniq -c | sort -rn

# Client versions seen, in order — the query that dates a client-side change
jq -r 'select(.event=="mcp_initialize")
  | [.timestamp, .clientName, .clientVersion] | @tsv' logs.jsonl

# Distinct client + protocol revision pairs: what is connecting, and with what
jq -r 'select(.event=="mcp_initialize")
  | [.clientName, .clientVersion, .requestedProtocolVersion] | @tsv' logs.jsonl | sort -u

# Clients asking for a protocol revision this server does not serve
jq -r 'select(.event=="mcp_initialize" and .protocolVersionMismatch)
  | [.timestamp, .clientName, .requestedProtocolVersion, .servedProtocolVersion] | @tsv' logs.jsonl
```

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
