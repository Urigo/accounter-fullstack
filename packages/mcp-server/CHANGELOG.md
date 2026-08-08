# @accounter/mcp-server

## 0.1.0

### Minor Changes

- [#3941](https://github.com/Urigo/accounter-fullstack/pull/3941)
  [`b828023`](https://github.com/Urigo/accounter-fullstack/commit/b82802376c5f1f4acc5de274b58348d87fcbe553)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Introduce `@accounter/mcp-server`, a remote
  MCP (Model Context Protocol) server that exposes a curated, read-only subset of Accounter
  capabilities to Claude clients (see `docs/mcp/spec.md`).

  - Streamable HTTP transport on `POST /mcp` (JSON-RPC 2.0), plus `/health`, `/metrics`, and RFC
    9728 OAuth protected-resource discovery.
  - Auth0 access-token verification (jose/JWKS) with a per-tool authorization policy. Business
    memberships and roles are resolved server-side by forwarding the caller's bearer token to the
    Accounter `myMemberships` query — never read from token claims.
  - Phase 1 read tools: charges search, tags and tax-category lookups, and a selected report reader,
    behind an output-shaping/truncation framework.
  - Cross-cutting concerns: unified error taxonomy, rate limiting, structured request logging, and
    metrics/tracing.

- [#4107](https://github.com/Urigo/accounter-fullstack/pull/4107)
  [`c8e336f`](https://github.com/Urigo/accounter-fullstack/commit/c8e336fa5f1d7e5b79c697983e9d772a135b40dc)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Export MCP server traces to OpenTelemetry
  (Grafana Tempo) and link them with the backend.

  The MCP server's tracing was previously a dependency-free stub. It now emits real OpenTelemetry
  spans over OTLP/HTTP to the same Grafana Tempo backend as the main server, using the same `OTEL_*`
  configuration (disabled by default; enable with `OTEL_ENABLED=1` and an
  `OTEL_EXPORTER_OTLP_ENDPOINT`). Spans come from Node auto-instrumentation (incoming `POST /mcp`,
  and the outbound `fetch` to the upstream GraphQL API) plus the existing `withSpan` units of work
  (`auth:verify`, `tool:<name>`, `upstream:graphql`), each tagged with an `accounter.correlation_id`
  attribute.

  MCP and backend traces are linked two ways: the outbound `fetch` propagates the W3C `traceparent`
  header, so the Accounter server continues the same distributed trace; and a new
  `correlationIdPlugin` on the server records an inbound `X-Correlation-Id` as the
  `accounter.correlation_id` span attribute, so both services' traces are searchable by the same
  business-level id in Grafana.

### Patch Changes

- [#4077](https://github.com/Urigo/accounter-fullstack/pull/4077)
  [`8fd3132`](https://github.com/Urigo/accounter-fullstack/commit/8fd313234afd20a41e6e6dae8053fd0d12110ca3)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Added a shared `dates.ts` module
  exporting `TIMELESS_DATE`, `parseCalendarDate`, and `DAY_MS`.
  - Updated `tools/charges.ts` and `tools/reports.ts` to import those primitives from `./dates.js`
    and removed their local copies.
  - Avoided per-call redefinition of `parseCalendarDate` in `reports.ts` by using the shared
    implementation.

- [#4115](https://github.com/Urigo/accounter-fullstack/pull/4115)
  [`0aaebfb`](https://github.com/Urigo/accounter-fullstack/commit/0aaebfbb9565a73d16f488e0f89df809f1b98476)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Split the MCP businesses tools into
  memberships vs. the full directory.

  - **Rename** the membership-discovery tool `accounter_list_businesses` →
    `accounter_list_business_memberships`. Its behavior is unchanged (pure, no upstream call, lists
    the caller's own memberships and role in each), but the name now says what it returns. It
    remains the scope-discovery entry point and still leads `tools/list`.
  - **Add** `accounter_list_businesses`, a read-only lookup — alongside `accounter_list_tags` and
    `accounter_list_tax_categories` — that lists the full business directory (id, name, `ownerId`,
    active flag) via the upstream `allBusinesses` query, not just the caller's memberships. Optional
    `nameContains` (forwarded to the upstream `allBusinesses(name:)` filter so the server narrows
    before serializing), `activeOnly`, and `businessIds` filters, with the same deterministic sort +
    size cap and echoed `scope.businessIds` as the other lookups.

  **Breaking for connector callers**: the membership tool is now
  `accounter_list_business_memberships`. Any `MCP_TOOL_ALLOWLIST` that named
  `accounter_list_businesses` for scope discovery must be updated, since that name now refers to the
  full-directory lookup.

- [#4081](https://github.com/Urigo/accounter-fullstack/pull/4081)
  [`f899b37`](https://github.com/Urigo/accounter-fullstack/commit/f899b37a1561ef168398d122f214d9802178707d)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Coherent owner/business scoping for the MCP
  connector.

  The connector handled multi-business ownership three inconsistent ways and never forwarded the
  caller's business scope upstream, so scope-less queries could not be narrowed at all and results
  were not attributable to a business.

  **Server** — expose `Tag.ownerId` (`UUID!`), backed by a migration that appends `owner_id` to the
  `accounter_schema.extended_tags` view.

  **MCP server**

  - Forward the resolved read scope upstream as `x-business-scope` on every tool call, so RLS on the
    Accounter server is the enforcement point. The upstream context is built once where the scope is
    known, so a tool handler cannot omit it. The membership bootstrap (`myMemberships`) is
    deliberately never scoped — it is the query that discovers the scope.
  - Fix charges scoping: filter by `byOwners` (the owner predicate) instead of `byBusinesses` (the
    counterparty predicate, from which upstream removes the owner), which had been returning only
    inter-company charges. The balance report now uses the requested `businessId` rather than the
    first id in scope.
  - Add `accounter_list_businesses`, a read-only discovery tool listing the caller's businesses and
    role in each. Registered first so it leads `tools/list`; the internal `accounter_smoke_ping` is
    no longer advertised, though it remains dispatchable.
  - Uniform scoping contract: every business-scoped tool takes the same optional `businessIds`, rows
    carry `ownerId` (charges also `ownerName`), and responses echo the effective
    `scope.businessIds`. Out-of-scope ids are rejected rather than silently dropped.
  - Extend GraphQL codegen document discovery to `src/upstream/*.ts`, so the membership query is
    validated against the schema like the tool queries.

- [#4108](https://github.com/Urigo/accounter-fullstack/pull/4108)
  [`edba2fc`](https://github.com/Urigo/accounter-fullstack/commit/edba2fc0f47bc87e2dfb8a4498697c2bd320f503)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Enrich detail tools to support
  filter-based retrieval in addition to by-id retrieval:
  - `accounter_get_charges` supports full `ChargeFilter` input.
  - `accounter_get_transactions` supports `transactionsByFilters` predicates.
  - `accounter_get_documents` supports `documentsByFilters` predicates.
  - Allow combining ids and filters in detail tools (ids + filters), and treat empty array inputs as
    undefined to match backend semantics.
  - Refactor detail-tool GraphQL documents to use shared fragments and one multi-operation document
    per tool, selecting operations with `operationName` to keep result structures consistent and
    reduce duplicate selection sets.
  - Normalize specific upstream not-found GraphQL errors from `chargesByIDs` / `transactionsByIDs`
    to empty successful results so out-of-scope or missing ids behave consistently with tool
    summaries.
  - Tighten `RawDocument.charge.owner` typing to match selected fields (`owner { id }`) and avoid
    accidental reliance on unselected `name` fields.

- [#4104](https://github.com/Urigo/accounter-fullstack/pull/4104)
  [`5bdb2c7`](https://github.com/Urigo/accounter-fullstack/commit/5bdb2c7e8817ab8ee1f08c6afb5dbabed4e1dd75)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Enforce `MCP_TOOL_ALLOWLIST`. The parsed
  allowlist was previously never read, so every registered tool was advertised and dispatchable
  regardless — harmless while phase 1 is read-only, but a real control gap once mutating tools land.
  `tools/list` now filters advertised tools through the allowlist and `tools/call` rejects an
  excluded tool as `Unknown tool` (indistinguishable from a nonexistent one, so the allowlist does
  not leak which capabilities exist). Semantics: an empty allowlist imposes no restriction (every
  tool exposed); a non-empty allowlist restricts to exactly the named tools. When narrowing, keep
  `accounter_list_businesses` in the set — it is the discovery entry point for business scoping.

- [#4123](https://github.com/Urigo/accounter-fullstack/pull/4123)
  [`0093f3b`](https://github.com/Urigo/accounter-fullstack/commit/0093f3b34abe51c346b1b41ddf891a3ae24ffbe5)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix unit tests that broke when the MCP tool
  limits were raised. Several tests hardcoded the old caps, so inputs meant to exceed a bound (a
  wide date range, an over-cap page size, a full lookup payload) became valid once the limits grew.
  The assertions now derive their boundary values from the exported constants (`MAX_PAGE_SIZE`,
  `MAX_DATE_RANGE_DAYS`, `MAX_REPORT_DATE_RANGE_DAYS`, `MAX_FILTERED_CHARGES`), and the byte-budget
  no-truncation case is pinned to a row count that genuinely fits the payload budget, so the suite
  tracks future limit changes.

- [#4105](https://github.com/Urigo/accounter-fullstack/pull/4105)
  [`64549f1`](https://github.com/Urigo/accounter-fullstack/commit/64549f15627899f397591585b4744dd1b0a392b2)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Key the rate limiter on `userId|toolName`
  instead of `userId|sortedScope|toolName`. Sorting already defeated permutation abuse, but distinct
  business-scope _subsets_ still mapped to distinct buckets, so a caller with N businesses could
  address up to 2^N−1 buckets per tool and multiply their effective quota — now that two tools
  accept a `businessIds` input. Every subset is already authorized, so scope in the key protected
  nothing and only fragmented the quota it is meant to bound. Tenant isolation is unaffected: it is
  enforced upstream by RLS via the forwarded `x-business-scope` header, not by the rate-limit key.

- [#4103](https://github.com/Urigo/accounter-fullstack/pull/4103)
  [`b61e81a`](https://github.com/Urigo/accounter-fullstack/commit/b61e81a03f3654389d6d600739ab01b375c266f1)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Tolerate a trailing slash on the MCP
  transport route. Previously only the exact path `/mcp` was routed, so `POST /mcp/` — a
  correct-looking URL — fell through to a `404` that was raised before the auth layer, so `/metrics`
  recorded nothing and the failure looked like an outage rather than a typo. Route lookup now
  normalizes the request path (stripping a trailing slash, preserving the root `/`), so `/mcp/`
  reaches the same handler, auth layer, and metrics as `/mcp`. `context.route` still carries the raw
  pathname for logging fidelity.

- [#4078](https://github.com/Urigo/accounter-fullstack/pull/4078)
  [`4e211ed`](https://github.com/Urigo/accounter-fullstack/commit/4e211ed9f629662bb3b20327fb11aa7d7842cdff)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - Extend GraphQL codegen document discovery
  to include MCP server tool source files and generate `typescript-operations` output for the MCP
  server.
  - Update MCP tool handlers (`charges`, `lookups`, `reports`) to use generated `Mcp*Query` /
    `Mcp*QueryVariables` types instead of local `Raw*` interfaces.
  - Ensure the new generated MCP output directory is cleared as part of `generate:graphql:clear`.
