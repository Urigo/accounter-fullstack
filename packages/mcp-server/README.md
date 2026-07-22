# @accounter/mcp-server

Remote MCP (Model Context Protocol) server that exposes a curated, **read-only** subset of Accounter
capabilities to Claude clients (Claude.ai / Claude Desktop).

See the design docs:

- [`docs/mcp/spec.md`](../../docs/mcp/spec.md) — connector specification
- [`docs/mcp/implementation-blueprint.md`](../../docs/mcp/implementation-blueprint.md) — incremental
  implementation plan

## Status

Early scaffolding. This package is being built incrementally following the prompt pack in the
implementation blueprint. It currently contains the package skeleton, strict environment
configuration, a minimal HTTP server with a `/health` endpoint and graceful shutdown, an MCP
transport route (`POST /mcp`) that speaks JSON-RPC 2.0 and lists an internal smoke tool, per-request
structured logging with request/correlation ids, the OAuth protected-resource metadata endpoint,
Auth0 bearer-token verification, identity mapping from a verified token to an internal user +
business-membership context, a curated tool registry with strict input validation, a per-tool
authorization policy evaluator, and a hardened upstream GraphQL client. The first production tool
(read-only charges search) is wired into `tools/list` / `tools/call` and enforces input validation,
authorization policy, and business-scope narrowing before execution. Operational telemetry
(request/outcome counters, a latency histogram, auth-failure counters, and tracing spans) is
recorded per process and exposed at `GET /metrics`.

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

- **`accounter_search_charges`** — read-only charges search/browse within the caller's authorized
  businesses. Optional `businessIds` (subset of memberships), `fromDate`/`toDate` (bounded to 366
  days), `tags`, `freeText`, and `flow` (`ALL`/`INCOME`/`EXPENSE`), with bounded pagination
  (`pageSize` ≤ 50). Returns normalized charges plus pagination metadata.
- **`accounter_list_tags`** — list tags for categorizing charges, optionally filtered by name.
  Deterministically sorted (name, then id) and size-capped (≤ 500).
- **`accounter_list_tax_categories`** — list tax categories (id, name, IRS code, active flag),
  optionally filtered by name or active status. Same deterministic sort + cap.
- **`accounter_balance_report`** — read-only balance report (transactions) for one of your
  businesses over a bounded date range (≤ 366 days). Requires `business_owner`/`accountant` role;
  rows are capped at 500 with a `truncated` flag.

## Upstream GraphQL client

Tool handlers talk to the Accounter GraphQL server through a single hardened client
(`src/upstream/graphql-client.ts`): a strict per-request **timeout** with cancellation, **bounded
retries** for idempotent read failures only (network errors, timeouts, and 5xx — never 4xx
auth/validation errors or GraphQL-level errors), **header propagation** of the correlation id and
the caller's `Authorization` bearer token, and **sanitized** upstream errors (no stack traces or
internal details). Phase 1 is read-only: mutations/subscriptions are refused, and there is **no**
generic "execute anything" surface — tools use typed read-only wrappers via `createReadOperation`.

## Identity & tenant scope

A verified token is mapped to an `McpAuthContext` — `userId`, `roles` (token scopes), business
`memberships`, and a `defaultReadScope` (every business the user belongs to). Memberships are read
from the token's `memberships` custom claim by default (the source is pluggable so a later step can
resolve them from the GraphQL upstream instead). Requested scope narrowing is validated against the
user's memberships: any business id outside them is rejected rather than silently dropped. These
shapes and rules mirror the server package's tenant-isolation model
(`packages/server/src/shared/helpers/auth-scope.ts`).

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
- **`latencyMs`** — a latency histogram with per-bucket (non-cumulative) counts in ms plus an
  `+Inf` overflow bucket, alongside running `count`/`sum` totals.
- **`authFailuresTotal`** — auth failure counter keyed by reason (`missing_token`, `invalid_token`).
- **`upstreamErrorsTotal`** — upstream failure counter keyed by category.
- **`rateLimitedTotal`** — total rate-limited requests.

A snapshot is exposed at `GET /metrics`:

```bash
curl http://localhost:3100/metrics
```

### Tracing spans

Lightweight tracing spans (`src/observability/tracing.ts`) wrap the key units of work — token
verification (`auth:verify`), tool execution (`tool:<name>`), and each upstream GraphQL call
(`upstream:graphql`) — emitting structured `span start`/`span end` debug logs carrying the
correlation id and span duration. The implementation is deliberately dependency-free so it can be
swapped for OpenTelemetry later without touching call sites.

## Running locally

```bash
# with required env vars set (see Configuration below):
yarn workspace @accounter/mcp-server dev
curl http://localhost:3100/health
# → {"status":"ok","service":"@accounter/mcp-server","version":"…","uptimeSeconds":…}
```

The server handles `SIGINT`/`SIGTERM` by closing connections and exiting cleanly (forcing exit after
a grace period).

### MCP endpoint

The transport lives at `POST /mcp` and accepts JSON-RPC 2.0. Requests **must** carry a valid Auth0
bearer token in the `Authorization` header. The token is verified (signature via the tenant JWKS,
plus `issuer`, `audience`, and expiry). A request with no token gets a `401` pointing at the
protected-resource metadata document; a request with an invalid/expired token gets a `401` with
`error="invalid_token"`. Supported methods: `initialize`, `ping`, `tools/list`, and `tools/call`
(for the internal `accounter_smoke_ping` tool). Unknown methods return a deterministic JSON-RPC
`-32601` error; notifications receive `202 Accepted` with no body.

```bash
curl -sX POST http://localhost:3100/mcp -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

Environment variables are validated at startup with a strict schema
([`src/config/env.ts`](src/config/env.ts)). Missing required variables or malformed values cause the
process to exit immediately with a clear error. Secrets are supplied via the environment only.

| Variable                      | Required | Default             | Description                                                     |
| ----------------------------- | -------- | ------------------- | --------------------------------------------------------------- |
| `MCP_PUBLIC_BASE_URL`         | yes      | —                   | Public HTTPS origin of this MCP server (used in OAuth metadata) |
| `AUTH0_ISSUER_URL`            | yes      | —                   | Auth0 issuer/tenant URL used to validate access tokens          |
| `AUTH0_AUDIENCE`              | yes      | —                   | Expected `aud` claim for incoming access tokens                 |
| `GRAPHQL_UPSTREAM_URL`        | yes      | —                   | Base URL of the Accounter GraphQL server the tools call         |
| `MCP_SERVER_PORT`             | no       | `3100`              | TCP port the HTTP transport listens on                          |
| `MCP_ENABLED`                 | no       | `1`                 | Master kill-switch (`1` on / `0` off)                           |
| `MCP_TOOL_ALLOWLIST`          | no       | `''` (none)         | Comma-separated tool names allowed (empty = least privilege)    |
| `AUTH0_JWKS_URL`              | no       | derived from issuer | JWKS endpoint; defaults to `<issuer>/.well-known/jwks.json`     |
| `GRAPHQL_UPSTREAM_TIMEOUT_MS` | no       | `10000`             | Upstream GraphQL request timeout budget (ms)                    |
| `MCP_RATE_LIMIT_CONFIG`       | no       | `''` (defaults)     | Optional rate-limit override spec (parsed by the limiter later) |

## Scripts

```bash
yarn workspace @accounter/mcp-server build     # tsc → dist/
yarn workspace @accounter/mcp-server dev       # run entrypoint with tsx (watch)
yarn workspace @accounter/mcp-server lint      # eslint
yarn workspace @accounter/mcp-server test      # vitest (package-scoped)
yarn workspace @accounter/mcp-server typecheck # tsc --noEmit
```
