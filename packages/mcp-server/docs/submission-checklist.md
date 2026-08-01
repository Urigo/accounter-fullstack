# MCP Connector — Submission Readiness Checklist

Readiness checklist for submitting `@accounter/mcp-server` as a remote MCP connector. Each item
reflects behavior implemented in `packages/mcp-server`; boxes are checked only where the current
code satisfies them.

## Transport & protocol

- [x] Streamable HTTP transport at `POST /mcp`, JSON-RPC 2.0.
- [x] Implements `initialize` (advertises `protocolVersion` + tool capability), `ping`,
      `tools/list`, `tools/call`.
- [x] Unknown methods → deterministic JSON-RPC `-32601`; notifications → `202 Accepted`, no body.
- [x] Malformed input mapped to correct JSON-RPC errors (parse `-32700`, invalid request/params
      `-32600`/`-32602`); request body size is bounded.
- [x] `GET /mcp` (server-initiated SSE) intentionally unsupported in phase 1 → `405`.

## Authentication & OAuth discovery

- [x] `GET /.well-known/oauth-protected-resource` (RFC 9728), fully config-driven.
- [x] Bearer tokens accepted via the `Authorization` header only — never query params
      (`bearer_methods_supported: ["header"]`).
- [x] Auth0 access-token verification: signature via tenant JWKS, plus `issuer`, `audience`, expiry.
- [x] Missing token → `401` with a `WWW-Authenticate` `resource_metadata` pointer; invalid/expired →
      `401` `error="invalid_token"`. Infra failures (e.g. JWKS outage) surface as `5xx`, not a
      misleading `401`.
- [x] Redirect URI to allow-list for hosted Claude: `https://claude.ai/api/mcp/auth_callback` (see
      `docs/mcp/spec.md` §6.3).

## Authorization & tenant isolation

- [x] Business memberships resolved server-side (`myMemberships`), never from token claims.
- [x] Per-tool authorization policy (required roles + business-scope) enforced **before** any
      upstream call.
- [x] Requested scope narrowing validated as a subset of memberships; out-of-scope requests denied
      (`AUTHORIZATION_ERROR`), never silently dropped.
- [x] Read-only phase 1: no mutations/subscriptions; no generic query surface.

## Tools & responses

- [x] Curated tool set: `accounter_list_businesses`, `accounter_search_charges`,
      `accounter_list_tags`, `accounter_list_tax_categories`, `accounter_balance_report`. Discovery
      is registered first so it leads `tools/list`; the internal `accounter_smoke_ping` is
      dispatchable but deliberately not advertised.
- [x] Uniform business scoping: optional `businessIds` (singular required `businessId` on the
      single-business report), out-of-scope ids rejected rather than dropped, resolved scope
      forwarded upstream as `x-business-scope` with RLS as the enforcement point.
- [x] Self-describing responses: rows carry `ownerId` (charges also `ownerName`) and every
      business-scoped tool echoes `scope.businessIds`.
- [x] Strict input schemas (unknown fields rejected); advertised JSON Schema matches runtime
      validation (`additionalProperties: false`).
- [x] Bounded, deterministic responses (date-range ≤ 366 days, page size ≤ 50, list caps 500,
      payload-size guard with `truncated`/`continuation` hints).
- [x] Unified error taxonomy returned as tool results (`isError` +
      `{ code, message, correlationId,     retryable? }`), with sanitized `INTERNAL_ERROR` for
      unexpected failures.

## Reliability & abuse protection

- [x] Hardened upstream client: per-request timeout with cancellation, bounded retries for
      idempotent reads only, sanitized errors.
- [x] Per-`tools/call` rate limiting keyed by `{user, business scope, tool}` → `RATE_LIMIT_ERROR`
      with `retryAfterMs`.
- [x] Kill-switch (`MCP_ENABLED=0`) for fast mitigation (disables `/mcp` + its metadata route).
- [ ] Tool allow-list (`MCP_TOOL_ALLOWLIST`) — parsed at startup but **not yet enforced** (does not
      restrict advertised/callable tools).
- [x] Graceful shutdown on `SIGINT`/`SIGTERM`.

## Observability

- [x] Structured request/completion logs with `requestId`/`correlationId`; secrets/tokens never
      logged.
- [x] Metrics snapshot at `GET /metrics` (request/outcome counters, latency histogram, auth-failure
      and upstream-error counters, rate-limited total).
- [x] Correlation id propagated upstream via `X-Correlation-Id`.
- [x] Tracing spans for `auth:verify`, `tool:<name>`, `upstream:graphql` (structured logs).

## Testing & docs

- [x] Unit test matrix across config, auth, policy, tools, output, taxonomy, rate limiting, metrics.
- [x] End-to-end integration/security suite (`src/__tests__/mcp-e2e.test.ts`): discovery, 401
      challenge, authenticated invocation, cross-tenant denial, unauthorized role, error taxonomy.
- [x] Performance/timeout suite with a benchmark artifact (`src/__tests__/perf.test.ts`).
- [x] Package README (run/env/troubleshooting/smoke test), operations runbook, and this checklist.

## Known gaps to disclose at submission

- [ ] Phase 2 write scope (mutating tools) — **not** implemented (by design; see the README).
- [ ] Metrics/rate-limiting are in-process per replica (no shared store / Prometheus exposition
      yet).
- [ ] Tracing is a dependency-free stub (not wired to OpenTelemetry).
- [ ] Loopback/Claude Code callback support is a later phase (hosted-Claude callback only for now).
