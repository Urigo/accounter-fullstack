# MCP Server — Release Notes

## Phase 1 (read-only connector) — initial release

The `@accounter/mcp-server` remote MCP connector is feature-complete for phase 1 and ready for
controlled rollout. It exposes a curated, **read-only** subset of Accounter to Claude clients over
the MCP Streamable-HTTP transport.

### Highlights

- **Transport**: `POST /mcp` (JSON-RPC 2.0) with `initialize`, `ping`, `tools/list`, `tools/call`;
  `/health`, `/metrics`, and RFC 9728 OAuth discovery; graceful shutdown; a `MCP_ENABLED=0`
  kill-switch (disables `/mcp` + its metadata route; `/health` and `/metrics` stay up).
- **Auth**: Auth0 bearer verification (JWKS signature, issuer, audience, expiry);
  standards-compliant `401` challenge with a protected-resource-metadata pointer. Tokens accepted
  via header only.
- **Tenant isolation**: business memberships resolved server-side via `myMemberships` (never from
  token claims); per-tool authorization policy (roles + business scope) enforced before any upstream
  call; scope narrowing validated as a subset of memberships.
- **Tools** (all read-only, bounded, deterministic): `accounter_search_charges`,
  `accounter_list_tags`, `accounter_list_tax_categories`, `accounter_balance_report`.
- **Reliability**: hardened upstream GraphQL client (timeout, bounded retries for idempotent reads,
  sanitized errors); per-`tools/call` rate limiting; a unified error taxonomy returned as tool
  results.
- **Observability**: structured logs with request/correlation ids, a `/metrics` snapshot
  (request/outcome counters, latency histogram, auth-failure and upstream-error counters), and
  dependency-free tracing spans.

### Acceptance

- Final wiring audit (`src/__tests__/acceptance.test.ts`): every registered tool is reachable via
  `tools/list` and routed through the shared auth/policy/error/output frameworks; no bypass paths;
  the temporary smoke stub has been removed.
- One-command gate: `yarn workspace @accounter/mcp-server acceptance` (lint → typecheck → build →
  unit + integration + smoke tests).
- Coverage: unit matrix, end-to-end integration/security suite, and a performance/timeout suite with
  a benchmark artifact.

### Known limitations

- **Read-only** — no mutations/subscriptions and no generic query surface. Phase 2 (write scope) is
  not implemented.
- Metrics and rate limiting are **in-process** per replica (no shared store / Prometheus exposition
  yet); tracing is a stub not wired to OpenTelemetry.

See [`packages/mcp-server/README.md`](../../packages/mcp-server/README.md),
[`operations-runbook.md`](./operations-runbook.md), and
[`submission-checklist.md`](./submission-checklist.md).
