---
'@accounter/mcp-server': minor
---

Introduce `@accounter/mcp-server`, a remote MCP (Model Context Protocol) server that exposes a
curated, read-only subset of Accounter capabilities to Claude clients (see `docs/mcp/spec.md`).

- Streamable HTTP transport on `POST /mcp` (JSON-RPC 2.0), plus `/health`, `/metrics`, and RFC 9728
  OAuth protected-resource discovery.
- Auth0 access-token verification (jose/JWKS) with a per-tool authorization policy. Business
  memberships and roles are resolved server-side by forwarding the caller's bearer token to the
  Accounter `myMemberships` query — never read from token claims.
- Phase 1 read tools: charges search, tags and tax-category lookups, and a selected report reader,
  behind an output-shaping/truncation framework.
- Cross-cutting concerns: unified error taxonomy, rate limiting, structured request logging, and
  metrics/tracing.
