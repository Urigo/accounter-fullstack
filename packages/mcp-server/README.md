# @accounter/mcp-server

Remote MCP (Model Context Protocol) server that exposes a curated, **read-only** subset of Accounter
capabilities to Claude clients (Claude.ai / Claude Desktop).

See the design docs:

- [`docs/mcp/spec.md`](../../docs/mcp/spec.md) — connector specification
- [`docs/mcp/implementation-blueprint.md`](../../docs/mcp/implementation-blueprint.md) — incremental
  implementation plan

## Status

Early scaffolding. This package is being built incrementally following the prompt pack in the
implementation blueprint. It currently contains the package skeleton and strict environment
configuration (no HTTP/MCP runtime behavior yet).

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
