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
structured logging with request/correlation ids, and the OAuth protected-resource metadata endpoint.
Token verification, authorization, and production tools are not implemented yet.

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
the response. Structured JSON logs are emitted at request start and completion, carrying
`requestId`, `correlationId`, `method`, `route`, and — on completion — `status` and `latencyMs`.
Secrets and authorization headers are never logged.

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

The transport lives at `POST /mcp` and accepts JSON-RPC 2.0. Requests **must** carry a bearer token
in the `Authorization` header — a request without one gets a `401` with a `WWW-Authenticate: Bearer`
header pointing at the protected-resource metadata document (token _validity_ is verified in a later
step). Supported methods: `initialize`, `ping`, `tools/list`, and `tools/call` (for the internal
`accounter_smoke_ping` tool). Unknown methods return a deterministic JSON-RPC `-32601` error;
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
