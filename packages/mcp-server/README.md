# @accounter/mcp-server

Remote MCP (Model Context Protocol) server that exposes a curated, **read-only** subset of Accounter
capabilities to Claude clients (Claude.ai / Claude Desktop).

See the design docs:

- [`docs/spec.md`](./docs/spec.md) — connector specification
- [`docs/implementation-blueprint.md`](./docs/implementation-blueprint.md) — incremental
  implementation plan
- [`docs/operations-runbook.md`](./docs/operations-runbook.md) — incident handling, metrics, log
  queries, rollback
- [`docs/submission-checklist.md`](./docs/submission-checklist.md) — connector submission readiness

## Status

Phase 1 (read-only) is feature-complete. The server provides: strict startup env validation; an HTTP
transport with `/health`, `/metrics`, the OAuth protected-resource metadata endpoint, and the MCP
route (`POST /mcp`, JSON-RPC 2.0) with graceful shutdown; Auth0 bearer-token verification; identity
mapping to an internal user + business-membership context with memberships resolved from the
Accounter GraphQL server; a curated registry of nine read-only tools
(`accounter_list_business_memberships`, `accounter_search_charges`, `accounter_get_charges`,
`accounter_get_transactions`, `accounter_get_documents`, `accounter_list_tags`,
`accounter_list_tax_categories`, `accounter_list_businesses`, `accounter_balance_report`) each gated
by strict input validation, a per-tool authorization policy, and business-scope narrowing forwarded
upstream as `x-business-scope`; a hardened upstream GraphQL client (timeout, bounded retries, header
propagation, sanitized errors); a unified error taxonomy; per-`tools/call` rate limiting; in-process
operational metrics (request/outcome counters, a latency histogram, auth-failure counters) exposed
at `GET /metrics`; and OpenTelemetry tracing exported to Grafana Tempo (opt-in), correlated with the
backend via `traceparent` and `X-Correlation-Id`.

Phase 2 (write scope) is **not** implemented — see
[Known limitations & phase 2](#known-limitations--phase-2-write-scope).

## Tools

`tools/call` for a registered tool runs input validation → authorization policy → handler. Every
failure is normalized through a single error taxonomy (`src/errors/taxonomy.ts`) and returned as a
tool result with `isError` and a `{ code, message, correlationId, retryable }` payload (plus
`issues` for validation and `retryAfterMs` for rate limiting). Machine codes (spec §10.2):
`VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `UPSTREAM_ERROR`,
`TIMEOUT_ERROR`, `RATE_LIMIT_ERROR`, `INTERNAL_ERROR`. Unexpected errors map to a sanitized
`INTERNAL_ERROR` — stack traces and internal details are never leaked.

List-producing tools build their output through a shared formatter (`src/tools/output.ts`) that caps
the serialized payload (dropping whole trailing items — never invalid JSON), reports `returnedCount`
/ `totalCount` / `truncated`, and attaches a `continuation` hint whenever not all results were
returned (an upstream cap or the payload-size guard).

Each `tools/call` is rate-limited (`src/rate-limit/`) with an in-memory fixed-window counter keyed
by **user + business scope + tool**, enforced before any upstream call. Exceeding the limit returns
a `RATE_LIMIT_ERROR` with `retryAfterMs`. Limits are configured via `MCP_RATE_LIMIT_CONFIG`
(`{"windowMs":60000,"max":60}` by default).

### Business scoping contract

Every business-scoped tool follows one convention, so the model learns it once:

- **Discover, then scope.** `accounter_list_business_memberships` returns
  `{ businessId, name, role }`. Pass those ids back as `businessIds` (or, for the balance report,
  the singular required `businessId`).
- **`businessIds` is optional and means "narrow".** Omitting it covers every business the caller
  belongs to. Any id outside the caller's memberships is **rejected**, never silently dropped.
- **The resolved scope is forwarded upstream** as `x-business-scope`, so RLS on the Accounter server
  is the actual enforcement point (see [Identity & tenant scope](#identity--tenant-scope)).
- **Rows are owner-tagged.** List rows carry `ownerId` (charges also carry `ownerName`), so results
  spanning several businesses can be grouped rather than silently merged.
- **The response echoes `scope.businessIds`.** A widened scope is visible in the payload instead of
  being inferred, and the charges summary text names the business count when it is greater than one.

`accounter_list_business_memberships` is the one exception: it takes no parameters and echoes no
scope, because it _is_ the scope.

- **`accounter_list_business_memberships`** — list the businesses the caller is a member of, with
  their role in each. Sorted by name (fixed-locale, case-insensitive) then id, with unnamed
  businesses last. Pure: memberships are already on the auth context, so it makes no upstream call.
  A caller with no memberships gets an empty list, not an error. This is the scope-discovery entry
  point; to browse the full business directory use `accounter_list_businesses`.
- **`accounter_search_charges`** — read-only charges search/browse within the caller's authorized
  businesses. Optional `businessIds` (subset of memberships), `fromDate`/`toDate` (bounded to 366
  days), `tags`, `freeText`, and `flow` (`ALL`/`INCOME`/`EXPENSE`), with bounded pagination
  (`pageSize` ≤ 50). Returns normalized charges — each carrying `ownerId`/`ownerName` — plus
  pagination metadata and the echoed `scope`. Scoping uses the `byOwners` predicate upstream (the
  owner), never `byBusinesses` (the counterparty).
- **`accounter_get_charges`** — read-only charge **detail** by id (1–25 `chargeIds`). Returns each
  charge with owner, counterparty, amounts (total, VAT, withholding), the full set of dates, tags,
  and `metadata` counts, plus — by default — its linked `transactions` and `documents` nested inline
  (toggle with `includeTransactions` / `includeDocuments`). This is the drill-down for
  `accounter_search_charges`. A charge whose `owner` falls outside the resolved scope is dropped as
  defense-in-depth on top of RLS.
- **`accounter_get_transactions`** — read-only bank/card **transactions** by id (1–50
  `transactionIds`). Each row carries direction, amount, event/effective dates, source description,
  `isFee`, `chargeId`, counterparty, and account. Scope is enforced upstream by RLS (transactions
  carry no owner field for a client-side filter).
- **`accounter_get_documents`** — read-only **documents** by id (1–50 `documentIds`). Each row
  carries `documentType`, serial number, date, amount, VAT, creditor/debtor, `chargeId`, and
  `file`/`image` links. A document whose owning charge falls outside the resolved scope is dropped
  as defense-in-depth on top of RLS.
- **`accounter_list_tags`** — list tags for categorizing charges, optionally filtered by name and by
  `businessIds`. Rows carry `ownerId`. Deterministically sorted (name, then id) and size-capped (≤
  500).
- **`accounter_list_tax_categories`** — list tax categories (id, name, `ownerId`, IRS code,
  bookkeeping sort code, active flag), optionally filtered by name, active status, or `businessIds`.
  Same deterministic sort + cap.
- **`accounter_list_businesses`** — list the full business directory (id, name, `ownerId`, active
  flag) — every business visible to the caller, not just their memberships — optionally filtered by
  name (forwarded to the upstream `allBusinesses(name:)` filter), active status, or `businessIds`.
  Same deterministic sort + cap. Use `accounter_list_business_memberships` instead for just the
  caller's own memberships and roles.
- **`accounter_balance_report`** — read-only balance report (transactions) for **exactly one** of
  your businesses over a bounded date range (≤ 366 days), selected by the required singular
  `businessId`. Requires `business_owner`/`accountant` role; rows are capped at 500 with a
  `truncated` flag. Rows are not individually owner-tagged — they all share the one owner, which the
  response reports once alongside the echoed `scope`.

## Upstream GraphQL client

Tool handlers talk to the Accounter GraphQL server through a single hardened client
(`src/upstream/graphql-client.ts`): a strict per-request **timeout** with cancellation, **bounded
retries** for idempotent read failures only (network errors, timeouts, and 5xx — never 4xx
auth/validation errors or GraphQL-level errors), **header propagation** of the correlation id, the
caller's `Authorization` bearer token, and the resolved read scope as `x-business-scope`, and
**sanitized** upstream errors (no stack traces or internal details). Phase 1 is read-only:
mutations/subscriptions are refused, and there is **no** generic "execute anything" surface — tools
use typed read-only wrappers via `createReadOperation`.

## Identity & tenant scope

A verified token is mapped to an `McpAuthContext` — `userId`, `roles` (token scopes), business
`memberships`, and a `defaultReadScope` (every business the user belongs to). Memberships are
resolved from the Accounter GraphQL server by forwarding the caller's bearer token to a dedicated
`myMemberships` query (`src/upstream/memberships.ts`) — never derived from token claims — so tenant
membership is always authoritative from the server's database. The membership source is a pluggable
seam (`MembershipSource`) for testing. Requested scope narrowing is validated against the user's
memberships: any business id outside them is rejected rather than silently dropped. These shapes and
rules mirror the server package's tenant-isolation model
(`packages/server/src/shared/helpers/auth-scope.ts`).

**RLS upstream is the enforcement point.** The resolved read scope is forwarded on every tool call
as the `x-business-scope` header, which the Accounter server turns into `app.current_business_scope`
and applies through row-level security. MCP-side narrowing is the _first_ gate, not the only one: it
rejects out-of-scope ids early with a legible `AUTHORIZATION_ERROR`, but the database is what
actually constrains the rows. This matters for the argument-less upstream queries (`allTags`,
`taxCategories`), which have no filter arguments to narrow — the header is the only mechanism
available to them.

The context is built once in `execute.ts`, where the resolved scope is known, and handlers receive
it as `context.upstream`. A handler therefore cannot forget to forward the scope; a registry-wide
test asserts every registered tool sends the header.

Two deliberate exceptions:

- **The membership bootstrap is never scoped.** `myMemberships` is the query that _discovers_ the
  scope, so scoping it would be circular, and a stale or unknown id would fail the whole request at
  authentication time rather than returning an empty list.
- **An empty scope sends no header at all.** Upstream reads an absent `x-business-scope` as "all of
  the caller's memberships", so emitting an empty header would widen the scope rather than narrow it
  — the exact opposite of the intent.

## OAuth discovery

`GET /.well-known/oauth-protected-resource` serves an
[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) protected-resource metadata document so Claude
clients can discover the authorization server:

```json
{
  "resource": "<MCP_PUBLIC_BASE_URL>",
  "authorization_servers": ["<AUTH0_ISSUER_URL>"],
  "bearer_methods_supported": ["header"]
}
```

The document is fully config-driven (no hardcoded URLs). `bearer_methods_supported: ["header"]`
signals that tokens are accepted only via the `Authorization` header, never query params.

## Observability

Every request is assigned a `requestId` and a `correlationId` (the latter inherited from an inbound
`X-Correlation-Id` header when present, otherwise generated). The correlation id is echoed back on
the response and propagated upstream via the `X-Correlation-Id` header on every GraphQL call.
Structured JSON logs are emitted at request start and completion, carrying `requestId`,
`correlationId`, `method`, `route`, and — on completion — `status` and `latencyMs`. Secrets and
authorization headers are never logged.

### Metrics

An in-memory metrics registry (`src/observability/metrics.ts`) records operational telemetry per
process (labels never carry PII — only tool names, outcome classes, and error categories):

- **`requestsTotal`** — request counter keyed by `"<tool>|<outcome>"`, where outcome is `success` or
  one of the taxonomy-derived error classes (`validation_error`, `authentication_error`,
  `authorization_error`, `rate_limited`, `upstream_error`, `timeout_error`, `internal_error`).
- **`latencyMs`** — a latency histogram with per-bucket (non-cumulative) counts in ms plus an `+Inf`
  overflow bucket, alongside running `count`/`sum` totals.
- **`authFailuresTotal`** — auth failure counter keyed by reason (`missing_token`, `invalid_token`).
- **`upstreamErrorsTotal`** — upstream failure counter keyed by category.
- **`rateLimitedTotal`** — total rate-limited requests.

A snapshot is exposed at `GET /metrics`:

```bash
curl http://localhost:3100/metrics
```

### Tracing (OpenTelemetry → Grafana Tempo)

The MCP server emits OpenTelemetry traces over OTLP/HTTP to the same Grafana Tempo backend as the
main Accounter server, using the same `OTEL_*` configuration conventions (see
[Configuration](#configuration)). Tracing is **off by default** and enabled with `OTEL_ENABLED=1`
plus an `OTEL_EXPORTER_OTLP_ENDPOINT`.

Spans come from two sources:

- **Auto-instrumentation** (`@opentelemetry/auto-instrumentations-node`): the incoming `POST /mcp`
  HTTP server span, and the outbound `fetch` client spans for upstream GraphQL calls (via the
  `undici` instrumentation).
- **Manual spans** (`src/observability/tracing.ts`, `withSpan`): token verification (`auth:verify`),
  tool execution (`tool:<name>`), and each upstream GraphQL call (`upstream:graphql`). Each carries
  the business-level `accounter.correlation_id` attribute. The `withSpan` signature is unchanged, so
  call sites did not move — and when OTEL is disabled it resolves to the API's no-op tracer at
  effectively zero cost.

The SDK is started from a `--import` preload (`src/bootstrap-telemetry.ts`) so instrumentation
patches `node:http`/`fetch` before the app loads, and flushed on graceful shutdown.

#### Linking MCP traces to the backend

Two mechanisms tie an MCP request to the backend work it triggers:

1. **W3C `traceparent` propagation (the distributed-trace join).** The upstream `fetch` is
   auto-instrumented, so `traceparent` is injected on every upstream GraphQL call and the Accounter
   server's HTTP instrumentation continues the **same trace**. A single Grafana trace therefore
   spans `POST /mcp` → `tool:<name>` → `upstream:graphql` → the backend HTTP/GraphQL/Postgres spans.
2. **`X-Correlation-Id` as a shared, searchable attribute.** The correlation id (inherited from the
   inbound header or generated) is set as `accounter.correlation_id` on the MCP spans and forwarded
   upstream as `X-Correlation-Id`; the backend records the same attribute on its spans (via its
   `correlationIdPlugin`). This lets you pivot from an MCP log line to the backend trace and search
   Tempo by the business-level id.

## Running locally

```bash
# with required env vars set (see Configuration below):
yarn workspace @accounter/mcp-server dev
curl http://localhost:3100/health
# → {"status":"ok","service":"@accounter/mcp-server","version":"…","uptimeSeconds":…}
```

The server handles `SIGINT`/`SIGTERM` by closing connections and exiting cleanly (forcing exit after
a grace period).

To connect this server to Claude Desktop as a custom connector — HTTPS tunnel, Auth0 application,
connector fields, and a troubleshooting table — see
[`docs/local-development.md`](./docs/local-development.md). Note that Claude requires an HTTPS
connector URL, so `http://localhost:3100` cannot be used directly.

### MCP endpoint

The transport lives at `POST /mcp` and accepts JSON-RPC 2.0. Requests **must** carry a valid Auth0
bearer token in the `Authorization` header. The token is verified (signature via the tenant JWKS,
plus `issuer`, `audience`, and expiry). A request with no token gets a `401` pointing at the
protected-resource metadata document; a request with an invalid/expired token gets a `401` with
`error="invalid_token"`. Supported methods: `initialize`, `ping`, `tools/list`, and `tools/call`
(the curated tools; the internal `accounter_smoke_ping` tool is still dispatchable by name but is no
longer advertised by `tools/list`). Unknown methods return a deterministic JSON-RPC `-32601` error;
notifications receive `202 Accepted` with no body.

```bash
curl -sX POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

Environment variables are validated at startup with a strict schema
([`src/config/env.ts`](src/config/env.ts)). Missing required variables or malformed values cause the
process to exit immediately with a clear error. Secrets are supplied via the environment only.

| Variable                      | Required | Default                  | Description                                                        |
| ----------------------------- | -------- | ------------------------ | ------------------------------------------------------------------ |
| `MCP_PUBLIC_BASE_URL`         | yes      | —                        | Public HTTPS origin of this MCP server (used in OAuth metadata)    |
| `AUTH0_ISSUER_URL`            | yes      | —                        | Auth0 issuer/tenant URL used to validate access tokens             |
| `AUTH0_AUDIENCE`              | yes      | —                        | Expected `aud` claim for incoming access tokens                    |
| `GRAPHQL_UPSTREAM_URL`        | yes      | —                        | Base URL of the Accounter GraphQL server the tools call            |
| `MCP_SERVER_PORT`             | no       | `3100`                   | TCP port the HTTP transport listens on                             |
| `MCP_ENABLED`                 | no       | `1`                      | Master kill-switch (`1` on / `0` off)                              |
| `MCP_TOOL_ALLOWLIST`          | no       | `''` (none)              | Comma-separated tool names allowed (empty = least privilege)       |
| `AUTH0_JWKS_URL`              | no       | derived from issuer      | JWKS endpoint; defaults to `<issuer>/.well-known/jwks.json`        |
| `GRAPHQL_UPSTREAM_TIMEOUT_MS` | no       | `10000`                  | Upstream GraphQL request timeout budget (ms)                       |
| `MCP_RATE_LIMIT_CONFIG`       | no       | `''` (defaults)          | Optional rate-limit override spec (parsed by the limiter later)    |
| `OTEL_ENABLED`                | no       | `0`                      | Enable OpenTelemetry tracing (`1` on / `0` off)                    |
| `OTEL_SERVICE_NAME`           | no       | `accounter-mcp-server`   | `service.name` resource attribute                                  |
| `OTEL_SERVICE_NAMESPACE`      | no       | `accounter`              | `service.namespace` resource attribute                             |
| `OTEL_DEPLOYMENT_ENV`         | no       | `NODE_ENV`/`development` | `deployment.environment.name` resource attribute                   |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | if OTEL  | —                        | OTLP/HTTP traces endpoint (e.g. `http://localhost:4318/v1/traces`) |
| `OTEL_EXPORTER_OTLP_HEADERS`  | no       | —                        | OTLP exporter headers as `key=value,key=value`                     |
| `OTEL_TRACES_SAMPLER`         | no       | `always_on`              | Sampler strategy (`always_on`, `parentbased_traceidratio`, …)      |
| `OTEL_TRACES_SAMPLER_ARG`     | if ratio | —                        | Ratio `0`–`1` for the ratio-based samplers                         |
| `OTEL_STARTUP_STRICT`         | no       | —                        | `true` ⇒ abort the process on a telemetry startup failure          |

## Scripts

```bash
yarn workspace @accounter/mcp-server build     # tsc → dist/
yarn workspace @accounter/mcp-server dev       # run entrypoint with tsx (watch)
yarn workspace @accounter/mcp-server lint      # eslint
yarn workspace @accounter/mcp-server test      # vitest (package-scoped)
yarn workspace @accounter/mcp-server typecheck # tsc --noEmit
yarn workspace @accounter/mcp-server benchmark # perf/timeout suite → bench/summary.md
```

## Smoke test

With the four required env vars set and the server running
(`yarn workspace @accounter/mcp-server dev`):

```bash
# 1. Health (no auth) → 200 {"status":"ok",...}
curl -s http://localhost:3100/health

# 2. OAuth discovery (no auth) → resource + authorization_servers
curl -s http://localhost:3100/.well-known/oauth-protected-resource

# 3. Unauthenticated MCP call → 401 with a WWW-Authenticate resource_metadata pointer
curl -si -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -i -E 'HTTP/|www-authenticate'

# 4. Authenticated tool list → the curated tools, accounter_list_business_memberships first
#    (accounter_smoke_ping is dispatchable but intentionally not listed)
TOKEN=<a valid Auth0 access token for AUTH0_AUDIENCE>
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 5. Discover the businesses you can read → [{ businessId, name, role }]
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"accounter_list_business_memberships","arguments":{}}}'

# 6. Authenticated tool call, scoped to one of those ids.
#    The response echoes scope.businessIds and every row carries ownerId.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"accounter_list_tags","arguments":{"businessIds":["<businessId from step 5>"]}}}'

# 7. Negative check: an id outside your memberships must be REJECTED, not ignored.
#    Expect isError: true and code AUTHORIZATION_ERROR.
curl -s -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"accounter_list_tags","arguments":{"businessIds":["00000000-0000-4000-8000-000000000000"]}}}'
```

The automated equivalent of steps 1–7 (with the Auth0 verifier and upstream mocked) lives in
`src/__tests__/mcp-e2e.test.ts` and runs with `yarn workspace @accounter/mcp-server test`.

## Troubleshooting

| Symptom                                                                         | Likely cause / fix                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Process exits at startup with `[env] Invalid environment …`                     | A required env var is missing/malformed. The printed report lists each offending key; fix and restart. Required: `MCP_PUBLIC_BASE_URL`, `AUTH0_ISSUER_URL`, `AUTH0_AUDIENCE`, `GRAPHQL_UPSTREAM_URL`. |
| `POST /mcp` returns `401` with no `error`                                       | No bearer token. The `WWW-Authenticate` header points at the metadata document.                                                                                                                       |
| `POST /mcp` returns `401` with `error="invalid_token"`                          | Token failed verification (signature/JWKS, `iss`, `aud`, or expiry). Confirm the token's audience matches `AUTH0_AUDIENCE` and the issuer matches `AUTH0_ISSUER_URL`.                                 |
| `/mcp` and `/.well-known/...` return `404` (`/health` + `/metrics` still `200`) | The kill-switch is on (`MCP_ENABLED=0`) — only the MCP transport and its OAuth metadata route are disabled; `/health` and `/metrics` stay up. Set `MCP_ENABLED=1`.                                    |
| Tool result `isError: true`, code `UPSTREAM_ERROR`/`TIMEOUT_ERROR`              | The Accounter GraphQL server was unreachable/slow. Check `GRAPHQL_UPSTREAM_URL` and `GRAPHQL_UPSTREAM_TIMEOUT_MS`; timeouts are retried (bounded), 4xx/GraphQL errors are not.                        |
| Tool result code `AUTHORIZATION_ERROR`                                          | The caller lacks a required role, requested a business outside their memberships, or has no memberships. Verify the token's scopes and the server-side `business_users` rows.                         |
| Tool result code `RATE_LIMIT_ERROR` with `retryAfterMs`                         | Per-`{user, scope, tool}` window exceeded. Back off for `retryAfterMs`, or tune `MCP_RATE_LIMIT_CONFIG`.                                                                                              |

## Known limitations & phase 2 (write scope)

Phase 1 is intentionally **read-only** and single-purpose:

- Only the four read-only tools above are exposed; there is no generic "run any query" surface and
  **no mutations/subscriptions** (the upstream client refuses them).
- Responses are **bounded** (date ranges ≤ 366 days, page size ≤ 50, list caps of 500, a
  payload-size guard) — very large result sets are truncated with a `truncated`/`continuation` hint
  rather than streamed in full.
- Rate limiting and metrics are **in-process** (per replica); there is no shared/Redis-backed
  limiter or Prometheus exposition yet (the limiter and metrics are behind swappable seams).
- Tracing is exported to OpenTelemetry/Grafana Tempo (opt-in via `OTEL_ENABLED=1`), but metrics
  remain in-process (`GET /metrics`) and are not yet exported over OTLP.

**Phase 2 (write scope)** — not implemented — will add mutating tools (e.g. tagging/updating
charges) behind: per-tool write policies and role checks reusing the server's authorization model;
the server's accountant-approval degradation on charge-mutating operations; write-target business
resolution (a single owning business per write, versus phase-1 multi-business read scope); and
idempotency/audit for writes. Until then, all tools are safe to expose to read-only assistant
workflows.
