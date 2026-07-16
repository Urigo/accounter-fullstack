# Accounter MCP Connector Specification

Status: Proposed Owner: Platform / Server Team Last Updated: 2026-07-15

## 1) Purpose

Expose a safe, production-grade subset of Accounter server capabilities through a remote MCP server
so Claude clients can interact with business data using approved tools.

This document is implementation-ready and defines:

- Scope and rollout phases
- Authentication and authorization architecture
- Tool exposure strategy and data handling rules
- Error handling and observability requirements
- Testing and release criteria

## 2) Confirmed Decisions

These decisions were explicitly selected and are treated as baseline requirements:

- Client surface for phase 1: Claude hosted surfaces (Claude.ai/Desktop)
- Authentication baseline: Auth0-based OAuth using existing identity model
- OAuth connector variant: CIMD preferred
- Initial capability scope: read-only tools only
- Deployment model: new monorepo package for MCP server
- Connector goal: directory-ready in near term
- Metadata hosting: same domain as MCP server with well-known routes
- Identity mapping: reuse existing Auth0 users and business memberships

## 3) Goals and Non-Goals

### 3.1 Goals

- Deliver a secure MCP endpoint with OAuth-based user consent.
- Reuse existing multi-tenant authorization model from server.
- Expose high-value read-only capabilities first.
- Provide strict tenant isolation and robust auditability.
- Be compatible with connector directory requirements.

### 3.2 Non-Goals (Phase 1)

- No destructive or financial write operations.
- No bypass of existing role/business membership checks.
- No parallel REST API creation.
- No broad GraphQL passthrough tool.

## 4) Existing Platform Facts to Reuse

- GraphQL server is the canonical business API surface.
- Multi-tenant scoping exists via business memberships and read/write scope helpers.
- API key and auth providers already exist, but OAuth user auth is preferred for hosted connector
  UX.
- Server architecture already uses operation-scoped providers and DI.
- Existing gateway package pattern can be reused for isolated protocol adapters.

## 5) High-Level Architecture

## 5.1 Package and Runtime Layout

Create a new package:

- packages/mcp-server

Primary components:

- HTTP transport layer implementing remote MCP server (Streamable HTTP)
- OAuth discovery/auth metadata endpoints
- Auth middleware (bearer token validation and identity extraction)
- Tool registry and input validation layer
- GraphQL orchestration client (calls existing server APIs)
- Output shaping/sanitization and truncation guard
- Structured logging, metrics, tracing hooks

## 5.2 Control Flow

1. Claude connects to MCP endpoint.
2. If unauthenticated, MCP returns 401 with WWW-Authenticate and resource metadata pointer.
3. Claude completes OAuth flow against Auth0 (CIMD path).
4. MCP validates access token.
5. Tool invocation arrives at MCP server.
6. MCP validates tool name + input schema + scope constraints.
7. MCP calls existing GraphQL operation(s).
8. MCP sanitizes/normalizes output, applies output size constraints.
9. MCP returns tool result with deterministic error mapping.

## 5.3 Dependency Direction

- mcp-server depends on server API contracts and shared auth utilities.
- mcp-server does not become a second source of business logic.
- Business rules remain in existing server modules/providers.

## 6) Authentication and Metadata Hosting

## 6.1 OAuth Mode

Use OAuth with Auth0 and CIMD.

Why:

- Avoid DCR client explosion at scale.
- Better operational stability for directory traffic.
- Preserves user-consent model and per-user access control.

## 6.2 Metadata Hosting Decision

Primary mode: same domain as MCP server for well-known routes.

Serve on MCP origin:

- /.well-known/oauth-protected-resource
- (If needed by deployment) path-specific protected resource document

Additionally, always return 401 with explicit:

- WWW-Authenticate: Bearer
  resource_metadata="https://<mcp-host>/.well-known/oauth-protected-resource"

This explicit pointer is required for reliability and prevents discovery failures in edge routing
scenarios.

## 6.3 Callback and Discovery Requirements

Auth server must support:

- Standard OAuth discovery metadata endpoints
- PKCE S256
- Form-url-encoded token endpoint requests
- Refresh-token flows compatible with public clients

Hosted Claude redirect URI to allow:

- https://claude.ai/api/mcp/auth_callback

If Claude Code support is added later, also support loopback callback patterns as a separate phase.

## 6.4 Token and Scope Model

Access token claims must map to:

- user identity
- tenant/business memberships
- role claims or resolvable roles from server

Scope strategy:

- Keep OAuth scopes coarse for transport access.
- Enforce fine-grained capability authorization in MCP tool authorization layer.

## 6.5 Security Constraints

- Never accept credentials in URL query params.
- Enforce HTTPS only.
- Reject missing/invalid token with 401 and standards-compliant headers.
- Keep auth endpoint latency comfortably under published connector limits.

## 7) Authorization and Tenant Isolation

## 7.1 Source of Truth

Authorization source of truth remains existing server logic:

- role checks
- business membership checks
- read/write scope resolution helpers

## 7.2 Tool-Level Access Policy

Each tool must define:

- required role set
- allowed business scope behavior
- data-classification level
- redaction policy

Phase 1 policy:

- Read-only tools
- Must require authenticated user context
- Must restrict data to authorized business scope

## 7.3 Scope Narrowing

Support explicit scope narrowing input (when needed), but only as subset of authorized memberships.

Rules:

- Requested scope outside memberships => forbidden
- Empty requested scope => default authorized read scope

## 8) Tool Exposure Strategy

## 8.1 Selection Framework

Expose only capabilities that pass all checks:

- Read-only
- High utility for assistant workflows
- Deterministic and bounded response shape
- Low compliance/destructive risk
- Strong existing authorization path

## 8.2 Initial Tool Groups (Phase 1)

Recommended initial groups:

- Charges browse/search (read-only)
- Tags and tax-category lookups
- Counterparty/business entity lookups
- Selected report generation queries (read-only)
- Ledger/query inspection (read-only)

Excluded in phase 1:

- Any merge/delete/batch destructive operation
- Ledger regeneration/locking
- Salary and payroll writes
- Provider credential operations
- Scraper or ingestion mutation surfaces

## 8.3 Tool Contract Design

For each tool define:

- name
- plain-language description
- strict JSON input schema
- deterministic output schema
- authorization policy
- pagination and filtering behavior
- max result size and truncation behavior

Avoid a generic runGraphQL tool because it bypasses curated safety controls.

## 9) Data Handling Specification

## 9.1 Input Validation

- Validate all tool inputs against strict schemas.
- Reject unknown fields by default.
- Apply server-side bounds on page size, date range, and query breadth.

## 9.2 Output Shaping

- Return only fields needed for tool use.
- Redact or omit secrets and internal-only metadata.
- Normalize timestamps, currency formatting, and nullable fields.

## 9.3 Size Limits and Truncation

Respect client constraints by design:

- Limit output payload length proactively.
- If data exceeds limits, return structured partial result with continuation hints.

## 9.4 PII and Sensitive Data

Define data classes:

- Public operational metadata
- Business-sensitive financial data
- High-sensitivity identity/credential data

Phase 1 tools must avoid high-sensitivity credential domains.

## 9.5 Caching

- Allow short-lived in-process cache (with strict TTL and maximum size limits, for example LRU
  eviction, to prevent memory exhaustion) only for non-sensitive metadata and schema descriptors.
- No cross-user cache key collisions.
- Cache keys must include user and business scope dimensions where relevant.

## 10) Error Handling Strategy

## 10.1 Transport/Auth Errors

- 401 Unauthorized for missing/invalid token
- Include WWW-Authenticate header and resource_metadata pointer
- 403 Forbidden for authenticated but unauthorized scope/capability

## 10.2 Tool Execution Errors

Error taxonomy:

- VALIDATION_ERROR: invalid input
- AUTHENTICATION_ERROR: token/session problem
- AUTHORIZATION_ERROR: scope/role violation
- UPSTREAM_ERROR: GraphQL/server downstream failure
- TIMEOUT_ERROR: upstream timeout
- RATE_LIMIT_ERROR: request throttled
- INTERNAL_ERROR: uncategorized failure

Each error response must include:

- stable machine code
- human-readable message safe for end users
- correlation id
- retryability hint

## 10.3 Upstream GraphQL Error Mapping

- Map GraphQL auth errors to auth categories above.
- Preserve business-safe details only.
- Remove stack traces and internal SQL details.

## 10.4 Timeouts and Retries

- Enforce strict upstream request timeout budget.
- Retry only idempotent read operations with bounded attempts.
- Never retry on authorization or validation failures.

## 11) Observability and Operations

## 11.1 Logging

Structured logs for every request:

- timestamp
- correlation_id
- request_id
- user_id (or pseudonymous id)
- business_scope
- tool_name
- outcome code
- latency_ms

Never log:

- access tokens
- refresh tokens
- raw secrets

## 11.2 Metrics

Required metrics:

- mcp_requests_total by tool and outcome
- mcp_request_latency_ms histogram
- auth_failures_total by reason
- upstream_graphql_errors_total by category
- rate_limited_total

## 11.3 Tracing

- Propagate correlation id to upstream GraphQL calls.
- Attach trace spans around auth validation and tool execution.

## 11.4 Rate Limiting

Apply per:

- user
- business
- tool

Start conservative for phase 1; tune after observed production behavior.

## 12) Implementation Plan (Developer-Ready)

## 12.1 Phase 0: Foundations

1. Scaffold packages/mcp-server with TS build, lint, test setup.
2. Implement Streamable HTTP MCP transport endpoint.
3. Implement health endpoint and graceful shutdown.
4. Add env schema and configuration loader.

Deliverable:

- running MCP server skeleton with no tools.

## 12.2 Phase 1: OAuth + Discovery

1. Implement well-known protected resource metadata route.
2. Implement 401 challenge behavior with resource_metadata pointer.
3. Wire Auth0 token validation with PKCE-compatible expectations.
4. Validate claim-to-user mapping against existing auth/user model.

Deliverable:

- end-to-end authenticated connection from Claude hosted surface.

## 12.3 Phase 2: Read-Only Tool Registry

1. Build curated tool registry abstraction.
2. Add first read-only tools from approved list.
3. Add strict input/output schemas and pagination bounds.
4. Add authorization policies per tool.

Deliverable:

- usable phase 1 feature set with read-only operations.

## 12.4 Phase 3: Hardening

1. Error taxonomy implementation and mapping.
2. Rate limiting and request budget controls.
3. Structured logs, metrics, trace propagation.
4. Payload truncation and partial-result pattern.

Deliverable:

- production-hardened connector behavior.

## 12.5 Phase 4: Directory Readiness

1. Complete security and reliability checklist.
2. Finalize connector metadata and documentation.
3. Perform submission dry-run and integration checks.

Deliverable:

- directory-ready connector package.

## 13) Testing Strategy

## 13.1 Unit Tests

- Auth header parsing and token validation helpers
- Scope narrowing and role checks
- Tool input validation
- Error mapper behavior
- Output truncation behavior

## 13.2 Integration Tests

- OAuth discovery and 401 challenge flow
- Token exchange and authenticated tool calls
- GraphQL upstream success/error translation
- Cross-tenant access denial
- Pagination and filtering correctness

## 13.3 Contract Tests

- MCP protocol compliance for tool listing/invocation
- Well-known metadata document shape
- WWW-Authenticate header conformance

## 13.4 Security Tests

- Token misuse/replay scenarios
- Invalid audience/issuer claims
- Scope escalation attempts
- Injection and malformed input fuzzing
- Secret leakage checks in logs

## 13.5 Performance and Reliability Tests

- Tool latency under expected concurrent load
- Timeout and retry behavior under upstream slowness
- Auth endpoint response-time compliance

## 13.6 End-to-End Acceptance Tests

Must pass before production:

- Claude hosted surface can connect and invoke tools
- Unauthorized business data is never returned
- All major failure modes return correct error classes
- Observability dashboards show complete request traces

## 14) Environment and Configuration

Define and validate env vars in package config, including:

- MCP_SERVER_PORT
- MCP_PUBLIC_BASE_URL
- MCP_ENABLED
- MCP_TOOL_ALLOWLIST
- AUTH0_DOMAIN
- AUTH0_AUDIENCE
- AUTH0_ISSUER_URL (optional override; default derived from AUTH0_DOMAIN)
- AUTH0_JWKS_URL (optional override; default derived from AUTH0_DOMAIN)
- GRAPHQL_UPSTREAM_URL
- GRAPHQL_UPSTREAM_TIMEOUT_MS
- MCP_RATE_LIMIT_CONFIG

Auth0 naming/mapping guidance for monorepo consistency:

- Prefer the existing server-style auth0 shape: AUTH0_DOMAIN + AUTH0_AUDIENCE.
- Derive issuer as https://<AUTH0_DOMAIN>/ when AUTH0_ISSUER_URL is not set.
- Derive JWKS URL as https://<AUTH0_DOMAIN>/.well-known/jwks.json when AUTH0_JWKS_URL is not set.
- If explicit AUTH0_ISSUER_URL or AUTH0_JWKS_URL are provided, treat them as overrides.

Defaults:

- secure by default
- least privilege
- explicit allowlist for tools in production

## 15) Risks and Mitigations

Risk: accidental overexposure of capabilities

- Mitigation: explicit tool allowlist + no generic GraphQL execution tool

Risk: auth discovery fragility

- Mitigation: same-domain well-known routes + explicit 401 resource_metadata pointer

Risk: tenant leakage

- Mitigation: mandatory scope checks + integration tests for cross-business denial

Risk: oversized output

- Mitigation: strict pagination, output caps, structured partial responses

Risk: operational blind spots

- Mitigation: mandatory logs/metrics/traces before launch

## 16) Open Questions (Resolve Before Coding Freeze)

- Which exact read-only report operations are included in MVP?
- Should business scope selection be explicit tool input or inferred default only in phase 1?
- Do we need connector-level feature flags per tenant for staged rollout?
- What is the exact SLO target for tool latency?

## 17) Done Criteria

Implementation is considered complete when:

- All phase 1 tools are implemented and tested
- OAuth connection works reliably on hosted Claude surfaces
- Security tests and tenant-isolation tests pass
- Observability and runbook documentation are complete
- Directory submission checklist is satisfied

## 18) Developer Kickoff Checklist

1. Create package skeleton in packages/mcp-server.
2. Implement OAuth discovery and 401 challenge flow.
3. Implement token validation and identity mapping.
4. Build curated read-only tool registry with strict schemas.
5. Add integration tests for auth, scope, and tool execution.
6. Add observability instrumentation.
7. Run full validation and prepare connector submission assets.
