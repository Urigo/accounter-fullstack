# Accounter MCP Implementation Blueprint and Incremental Prompt Pack

Status: Draft for execution Related spec: docs/mcp/spec.md Last updated: 2026-07-15

## 1) How to use this document

This is an execution plan for building the MCP connector defined in docs/mcp/spec.md.

It is intentionally iterative:

1. Start with a full end-to-end blueprint.
2. Decompose into implementation chunks.
3. Decompose again into right-sized steps.
4. Use the prompt pack to drive a code-generation LLM through safe, incremental implementation.

Each prompt is designed to build on the previous prompt with no orphaned code.

## 2) Foundation constraints

- Phase 1 target: hosted Claude surfaces (Claude.ai/Desktop)
- Auth stack: Auth0 OAuth, CIMD-first
- Scope: read-only tools only
- Package boundary: new package at packages/mcp-server
- Metadata hosting: same domain plus explicit 401 resource_metadata pointer
- Authorization source of truth: existing server auth and business membership model
- No generic GraphQL passthrough tool

## 3) End-to-end blueprint (single-pass view)

## 3.1 Workstream A: Runtime and package foundation

1. Create packages/mcp-server package scaffold.
2. Add TypeScript config, linting, tests, and scripts with yarn workspace conventions.
3. Build HTTP server entrypoint with graceful shutdown and health route.
4. Add configuration loader with strict environment validation.

Exit condition:

- Service starts in local/dev mode, health endpoint works, tests run.

## 3.2 Workstream B: MCP transport and protocol skeleton

1. Implement Streamable HTTP MCP endpoint.
2. Implement protocol handshake and a minimal tool listing path.
3. Add request/response context with correlation id.
4. Add deterministic stub tool for smoke testing.

Exit condition:

- MCP endpoint is reachable and can list at least one test tool.

## 3.3 Workstream C: OAuth discovery and authentication

1. Serve protected resource metadata on well-known path.
2. Add standards-compliant 401 challenge with WWW-Authenticate and resource_metadata pointer.
3. Implement bearer token validator using Auth0 issuer/audience/JWKS.
4. Add claim mapping into internal auth identity model.

Exit condition:

- Unauthenticated calls get correct challenge.
- Valid token establishes authenticated request context.

## 3.4 Workstream D: Authorization and tool-policy enforcement

1. Build tool policy model (roles, scope, redaction level).
2. Enforce business membership and scope narrowing constraints.
3. Add per-tool auth checks before execution.
4. Add explicit deny behavior for unauthorized scope.

Exit condition:

- Cross-tenant and unauthorized role requests are rejected deterministically.

## 3.5 Workstream E: Upstream GraphQL orchestration

1. Build GraphQL client abstraction with timeout, retry rules, and error translation.
2. Add typed operation wrappers for phase 1 read-only operations.
3. Normalize output shape and pagination behavior.
4. Add output limits and truncation continuation hints.

Exit condition:

- At least two production tools return bounded, safe results.

## 3.6 Workstream F: Production hardening

1. Implement full error taxonomy and mapping.
2. Add structured logging and metrics.
3. Add optional tracing spans and correlation propagation.
4. Add rate limiting by user, business, tool.

Exit condition:

- Failure modes are observable and controlled.

## 3.7 Workstream G: Testing, release, and directory readiness

1. Unit tests for auth, policy, schema validation, and mappers.
2. Integration tests for OAuth challenge flow and tool execution.
3. Security tests for tenant isolation and malformed input.
4. Performance checks for latency and timeout budgets.
5. Submission readiness checklist and ops runbook.

Exit condition:

- Connector can be validated for directory submission with predictable behavior.

## 4) Decomposition round 1: delivery chunks (epic-sized)

This first decomposition groups work into medium chunks that can be assigned to one engineer per 1-3
days.

### Chunk R1-1: Package setup and runtime skeleton

- Includes workstreams A and part of B
- Estimated size: 1.5-2 days
- Risk: low

### Chunk R1-2: MCP protocol baseline

- Remaining B
- Estimated size: 1-1.5 days
- Risk: low

### Chunk R1-3: OAuth discovery and token validation

- Workstream C
- Estimated size: 2-3 days
- Risk: medium

### Chunk R1-4: Policy enforcement layer

- Workstream D
- Estimated size: 1.5-2 days
- Risk: medium

### Chunk R1-5: First toolset integration

- Workstream E
- Estimated size: 2-3 days
- Risk: medium

### Chunk R1-6: Hardening and observability

- Workstream F
- Estimated size: 2 days
- Risk: medium

### Chunk R1-7: Test matrix and release prep

- Workstream G
- Estimated size: 2-3 days
- Risk: medium

Assessment: good strategic grouping, but still too large for safe LLM code generation in one prompt
per chunk.

## 5) Decomposition round 2: implementation slices (story-sized)

This decomposition splits each epic into slices that can usually be done in a single focused PR.

### Slice S2-1: package scaffold and scripts

### Slice S2-2: env schema and config accessors

### Slice S2-3: HTTP server bootstrap and health route

### Slice S2-4: MCP endpoint shell and list-tools stub

### Slice S2-5: request context and correlation ids

### Slice S2-6: well-known metadata route

### Slice S2-7: 401 challenge middleware

### Slice S2-8: Auth0 token verifier module

### Slice S2-9: identity mapping and auth context

### Slice S2-10: tool registry abstraction and schema contracts

### Slice S2-11: authorization policy checks per tool

### Slice S2-12: GraphQL client with timeout/retry guardrails

### Slice S2-13: first production tool (charges query)

### Slice S2-14: second production tool (tags/tax categories)

### Slice S2-15: third production tool (selected report read)

### Slice S2-16: output shaping, limits, truncation helpers

### Slice S2-17: error taxonomy and mapper integration

### Slice S2-18: rate limiting middleware

### Slice S2-19: structured logging and metrics

### Slice S2-20: integration and security tests

### Slice S2-21: directory readiness docs and runbook

Assessment: much better, but still some slices mix too many moving parts (for example S2-12, S2-20).

## 6) Decomposition round 3: right-sized steps (final execution sequence)

This is the final, implementation-safe sequence. Each step is intended to be small enough for
low-risk implementation and review while still moving the project forward.

## 6.1 Final step list

1. Create package skeleton at packages/mcp-server with package.json, tsconfig, src/index.ts, and
   basic yarn scripts.
2. Add local lint/test/build scripts and wire into workspace without affecting existing packages.
3. Add env schema module and fail-fast startup validation.
4. Add minimal HTTP server bootstrap and /health route.
5. Add graceful shutdown and error-safe process handlers.
6. Add MCP route shell with request parsing and placeholder response.
7. Add MCP list-tools response with one internal smoke tool.
8. Add request context utility with request id and correlation id propagation.
9. Add structured logger wrapper and request logging middleware.
10. Add protected resource metadata route under well-known path.
11. Add universal unauthenticated response helper returning 401 + WWW-Authenticate resource_metadata
    pointer.
12. Add bearer token extraction and validation middleware boundary.
13. Implement Auth0 JWKS token verification module.
14. Map token claims to internal authenticated user context.
15. Add auth guard to MCP tool execution path.
16. Implement tool registry type contracts (name, schema, auth policy, handler).
17. Implement input schema validator adapter for tool invocations.
18. Implement authorization policy evaluator (role + business scope checks).
19. Implement GraphQL upstream client with timeout and non-destructive retry rules.
20. Implement upstream error classifier and safe message sanitizer.
21. Implement first tool: read-only charges search/browse with bounded pagination.
22. Implement second tool: tag and tax-category lookup with bounded output.
23. Implement third tool: selected report read operation with strict input bounds.
24. Implement output shaping helpers and partial-result continuation token format.
25. Add tool-level output size guardrails and truncation behavior.
26. Add final error taxonomy mapper across transport/auth/tool/upstream errors.
27. Add per-user/per-business/per-tool rate limiting middleware.
28. Add metrics counters and latency histograms.
29. Add trace hooks and propagation to upstream GraphQL calls.
30. Add unit tests for config/auth/policy/error/output helpers.
31. Add integration tests for 401 challenge, auth success, and tool invocation flow.
32. Add security tests for cross-tenant denial and malformed input handling.
33. Add performance test for latency and timeout behavior under read workloads.
34. Add connector runbook, deployment notes, and submission readiness checklist.
35. Add end-to-end local validation script and final wiring checklist.

## 6.2 Why this is right-sized

- Most steps fit in one focused PR.
- Each step has clear preconditions from previous steps.
- No step introduces more than one architectural concern at once.
- Tool implementation starts only after auth, policy, and upstream client foundations exist.
- Observability and tests are integrated before final release prep.

## 7) Dependency map for safe sequencing

- Steps 1-5 must complete before 6-9.
- Steps 10-15 must complete before any production tool steps.
- Steps 16-20 must complete before steps 21-25.
- Steps 26-29 should complete before full integration testing.
- Steps 30-35 close quality and release readiness.

## 8) Prompt pack for code-generation LLM

Use prompts in strict order. Do not skip ahead. Each prompt assumes previous prompts are implemented
and committed.

---

## Prompt 01 - Scaffold package and scripts

```text
You are implementing Prompt 01 of an incremental MCP build.

Goal:
Create a new package at packages/mcp-server with minimal TypeScript scaffolding and workspace scripts.

Requirements:
- Add package.json with build, dev, lint, test scripts.
- Add tsconfig.json aligned with monorepo TypeScript standards.
- Add src/index.ts with a no-op startup entrypoint.
- Ensure yarn workspace commands can run for this package.
- Do not modify unrelated packages.

Constraints:
- Use yarn only.
- Keep implementation minimal and compilable.
- No runtime framework lock-in yet.

Validation:
- yarn workspace mcp-server build passes.
- yarn workspace mcp-server test runs (can be placeholder).

Output:
- Show exact files created/updated and why.
```

## Prompt 02 - Add strict env config

```text
You are implementing Prompt 02.

Goal:
Add strict environment validation and config access for mcp-server.

Requirements:
- Create config/env module using schema validation.
- Include required vars for MCP host/port, auth issuer/audience/jwks, upstream GraphQL URL/timeouts.
- Fail fast on startup when env is invalid.
- Export typed config object for use by server modules.

Constraints:
- Keep defaults secure.
- Do not embed secrets.

Validation:
- Unit tests for valid and invalid env scenarios.
- Startup fails with clear errors when required vars are missing.

Output:
- Include a short env variable table in comments or docs for this package.
```

## Prompt 03 - HTTP server bootstrap and health

```text
You are implementing Prompt 03.

Goal:
Stand up a minimal HTTP server with health endpoint and graceful shutdown hooks.

Requirements:
- Add HTTP server bootstrap in src/index.ts or src/server.ts.
- Add GET /health endpoint returning service status and version.
- Add graceful shutdown for SIGINT/SIGTERM.
- Add centralized top-level error handling for startup failures.

Constraints:
- Keep dependencies minimal.
- No MCP protocol logic yet.

Validation:
- Server starts locally.
- /health returns 200.
- Shutdown logs and exits cleanly.
```

## Prompt 04 - MCP route shell and list-tools stub

```text
You are implementing Prompt 04.

Goal:
Add a basic MCP transport route and return a valid list-tools response with one internal smoke tool.

Requirements:
- Add MCP endpoint path with request dispatch skeleton.
- Implement list-tools handling.
- Return one smoke tool entry (non-production tool).
- Return deterministic unsupported-method errors for unknown operations.

Constraints:
- Keep this auth-agnostic for now.
- No upstream GraphQL calls yet.

Validation:
- MCP inspector or local request can list tools.
- Unknown method returns stable error shape.
```

## Prompt 05 - Request context and structured logging foundation

```text
You are implementing Prompt 05.

Goal:
Introduce request context and structured logs for observability groundwork.

Requirements:
- Add request id and correlation id generation/extraction utility.
- Propagate context through request lifecycle.
- Add structured logger wrapper with level, request id, correlation id, route/method, latency.
- Add middleware/hooks to log request start/end and failures.

Constraints:
- Never log secrets or authorization headers.

Validation:
- Logs include correlation_id and request_id.
- Error logs include machine-readable fields.
```

## Prompt 06 - Protected resource metadata route

```text
You are implementing Prompt 06.

Goal:
Add OAuth protected resource metadata endpoint on well-known path.

Requirements:
- Serve /.well-known/oauth-protected-resource.
- Include resource value matching MCP public URL.
- Include authorization_servers pointing to Auth0 issuer.
- Ensure JSON content-type and stable document shape.

Constraints:
- Keep document generation config-driven.
- No hardcoded environment-specific URLs.

Validation:
- Route returns 200 with valid JSON.
- Resource URL exactly matches configured MCP URL.
```

## Prompt 07 - 401 challenge helper with resource_metadata pointer

```text
You are implementing Prompt 07.

Goal:
Implement standardized unauthenticated response for MCP auth discovery.

Requirements:
- Create reusable helper for 401 responses.
- Add WWW-Authenticate Bearer header with resource_metadata URL pointer.
- Use this helper for unauthenticated MCP calls.

Constraints:
- Must be RFC-compliant enough for connector flows.
- Do not return tool-level errors for missing auth.

Validation:
- Unauthenticated request returns 401 and expected header.
- Header URL points to the well-known metadata route.
```

## Prompt 08 - Token extraction and Auth0 verification module

```text
You are implementing Prompt 08.

Goal:
Add bearer token extraction and Auth0 JWT verification.

Requirements:
- Parse Authorization: Bearer <token> header.
- Verify token using Auth0 issuer, audience, and JWKS (reusing or adapting the existing shared auth utilities and jose setup where possible).
- Enforce token expiry and signature checks.
- Return typed auth principal object on success.

Constraints:
- No token in query params.
- Never log raw token values.

Validation:
- Unit tests: valid token accepted, wrong issuer/audience rejected, expired token rejected.
```

## Prompt 09 - Identity mapping to business scope

```text
You are implementing Prompt 09.

Goal:
Map verified token identity to internal user + business membership context.

Requirements:
- Build auth context object containing user id, roles, authorized memberships, and default read scope.
- Reuse existing server-side identity/membership assumptions where possible.
- Add a clear failure mode when mapping cannot resolve a valid user.

Constraints:
- Keep phase 1 read-only semantics.
- No write-target resolution needed yet.

Validation:
- Unit/integration tests for user with multiple businesses and narrowed scope behavior.
```

## Prompt 10 - Tool registry contracts and input validation

```text
You are implementing Prompt 10.

Goal:
Create a production-ready tool registry abstraction.

Requirements:
- Define tool contract type with name, description, input schema, auth policy, handler.
- Add registration API and lookup.
- Add strict input validation with unknown-field rejection.
- Add deterministic validation error payload.

Constraints:
- Registry must support incremental tool additions.
- Keep handlers pure and testable.

Validation:
- Unit tests for registration, duplicate names, and schema failures.
```

## Prompt 11 - Authorization policy evaluator

```text
You are implementing Prompt 11.

Goal:
Implement policy checks per tool before execution.

Requirements:
- Evaluate required roles and business scope constraints.
- Deny requests outside authorized memberships with AUTHORIZATION_ERROR.
- Support optional caller-provided scope narrowing only if subset of authorized scope.

Constraints:
- Policy logic must run before handler execution.
- Keep behavior deterministic and test-covered.

Validation:
- Tests for allow, deny, and scope-subset edge cases.
```

## Prompt 12 - GraphQL upstream client with timeout/retry guardrails

```text
You are implementing Prompt 12.

Goal:
Add a shared upstream GraphQL client used by tool handlers.

Requirements:
- Implement request function with typed query/mutation wrappers for read-only operations.
- Add timeout budget and cancellation.
- Retry only idempotent read failures (bounded attempts, no auth/validation retries).
- Propagate correlation id and the authenticated user's Authorization bearer token to upstream headers.

Constraints:
- No generic execute-anything API exposed to tools.
- Forward Authorization only from authenticated request context, and never log or persist raw token values.
- Sanitize upstream errors.

Validation:
- Unit tests for timeout, retry eligibility, and upstream header propagation (correlation id and Authorization).
```

## Prompt 13 - Tool 1: charges search/browse (read-only)

```text
You are implementing Prompt 13.

Goal:
Implement the first production tool for read-only charges browsing/search.

Requirements:
- Add tool registration and handler using upstream GraphQL client.
- Define strict input schema: filters, date range, page size, cursor/page token.
- Enforce max page size and bounded date ranges.
- Return normalized output shape with pagination metadata.

Constraints:
- Read-only operations only.
- Respect business scope from auth context.

Validation:
- Integration tests for successful read, empty results, and invalid filters.
```

## Prompt 14 - Tool 2: tags and tax-category lookup (read-only)

```text
You are implementing Prompt 14.

Goal:
Implement lookup tool(s) for tags and tax categories.

Requirements:
- Add one or two tools depending on clean API design.
- Keep input minimal and output deterministic.
- Enforce output size caps and sort order stability.

Constraints:
- No write behavior.
- Keep response fields limited to tool use cases.

Validation:
- Integration tests for standard lookups and scope enforcement.
```

## Prompt 15 - Tool 3: selected report read operation

```text
You are implementing Prompt 15.

Goal:
Add one high-value report generation/read tool from approved phase 1 list.

Requirements:
- Define strict schema with tight limits (date range, report type enum, pagination if needed).
- Call upstream read-only report query.
- Normalize and bound output for MCP result constraints.

Constraints:
- Start with one report only.
- Avoid large unbounded payloads.

Validation:
- Tests for valid report, invalid range, and oversized-result handling.
```

## Prompt 16 - Output shaping and truncation framework

```text
You are implementing Prompt 16.

Goal:
Implement reusable output shaping and truncation support for all tools.

Requirements:
- Add centralized output formatter utilities.
- Add max payload guard with deterministic truncation behavior.
- Return continuation hints/tokens when truncation occurs.
- Ensure all existing tools use this shared formatter.

Constraints:
- Preserve schema stability while truncating.
- Never cut JSON structure into invalid output.

Validation:
- Unit tests for payload limit boundaries and continuation metadata.
```

## Prompt 17 - Unified error taxonomy and mapper

```text
You are implementing Prompt 17.

Goal:
Apply a single error taxonomy and mapper across transport, auth, policy, tool, and upstream failures.

Requirements:
- Implement machine codes: VALIDATION_ERROR, AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, UPSTREAM_ERROR, TIMEOUT_ERROR, RATE_LIMIT_ERROR, INTERNAL_ERROR.
- Map all existing error sources into taxonomy.
- Include correlation id and retryable boolean in error payload.

Constraints:
- Do not leak stack traces or SQL/internal details.

Validation:
- Unit tests for all mapping branches.
- Integration tests to verify consistent response shapes.
```

## Prompt 18 - Rate limiting middleware

```text
You are implementing Prompt 18.

Goal:
Add rate limiting per user, business, and tool.

Requirements:
- Implement configurable limiter middleware.
- Enforce limits before expensive upstream calls.
- Return RATE_LIMIT_ERROR with retry guidance.

Constraints:
- Start with in-memory limiter for phase 1 unless shared store already exists.
- Keep limiter keys scoped to authenticated identity + tool + business.

Validation:
- Tests for allowed burst, limit exceeded, and reset behavior.
```

## Prompt 19 - Metrics and tracing integration

```text
You are implementing Prompt 19.

Goal:
Add operational telemetry required for production readiness.

Requirements:
- Add request counters by tool/outcome.
- Add latency histogram.
- Add auth failure counters by reason.
- Add optional tracing spans around auth validation and upstream calls.
- Ensure correlation id propagates into logs and upstream requests.

Constraints:
- Keep PII handling safe.

Validation:
- Unit/integration checks that metrics increment correctly on success/failure.
```

## Prompt 20 - Unit test matrix completion

```text
You are implementing Prompt 20.

Goal:
Complete broad unit test coverage for core modules.

Requirements:
- Cover env config validation.
- Cover token validation edge cases.
- Cover policy evaluator.
- Cover registry/schema validation.
- Cover error mapper and output truncation.

Constraints:
- Tests should be deterministic and not call real external services.

Validation:
- Test suite passes with meaningful branch coverage.
```

## Prompt 21 - Integration and security tests

```text
You are implementing Prompt 21.

Goal:
Add integration/security tests that verify end-to-end behavior.

Requirements:
- Test 401 challenge and metadata discovery paths.
- Test authenticated tool invocation success.
- Test cross-tenant denial.
- Test malformed input and error taxonomy correctness.
- Test unauthorized role behavior.

Constraints:
- Use fixtures/mocks for upstream GraphQL where appropriate.

Validation:
- CI-ready integration suite with stable pass/fail signals.
```

## Prompt 22 - Performance and timeout validation

```text
You are implementing Prompt 22.

Goal:
Add practical performance and timeout tests for phase 1 workloads.

Requirements:
- Add load test scenario for read-only tool calls.
- Validate timeout and retry behavior under delayed upstream responses.
- Confirm latency stays within team target under baseline concurrency.

Constraints:
- Keep tests lightweight enough for regular execution or nightly profile.

Validation:
- Produce a short benchmark summary artifact.
```

## Prompt 23 - Deployment docs, runbook, and submission checklist

```text
You are implementing Prompt 23.

Goal:
Finalize documentation and operational readiness for launch and directory submission.

Requirements:
- Add package-level README for local run, env setup, and troubleshooting.
- Add operations runbook: incident handling, key metrics, log queries, rollback steps.
- Add connector submission readiness checklist aligned with current implementation.
- Document known limitations and phase 2 write-scope plan.

Constraints:
- Keep docs accurate to implemented behavior only.

Validation:
- New engineer can run service and execute smoke tests using docs alone.
```

## Prompt 24 - Final wiring and acceptance gate

```text
You are implementing Prompt 24.

Goal:
Perform final wiring audit and acceptance checks with no orphaned code.

Requirements:
- Verify all registered tools are reachable through MCP endpoint.
- Verify every tool uses shared auth, policy, error, and output frameworks.
- Remove or integrate temporary smoke stubs.
- Add final acceptance script that runs lint, build, unit tests, integration tests, and smoke checks.
- Produce a concise release note summary.

Constraints:
- No dead modules.
- No bypass paths around auth/policy.

Validation:
- Acceptance script passes end-to-end.
- System is ready for controlled rollout.
```

## 9) Review checklist for each prompt execution

Use this checklist after each prompt:

- Is the change fully integrated into existing flow?
- Are tests added or updated for the new behavior?
- Are logs/metrics safe and useful?
- Is auth/policy enforced before data access?
- Is there any temporary code not wired into production path?

If any answer is no, fix before moving to the next prompt.

## 10) Suggested PR cadence

- One prompt per PR for prompts 01-12.
- Prompts 13-16 may be one PR each due to behavior surface.
- Prompts 17-24 can be one PR per prompt or paired only when tightly related.

Do not batch multiple prompts if it reduces reviewability or test clarity.
