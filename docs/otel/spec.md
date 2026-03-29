# OTEL + Tempo Integration Specification for Server

## 1. Objective

Implement OpenTelemetry tracing in the server so all inbound GraphQL requests, downstream PostgreSQL
calls, and relevant outbound HTTP calls produce traces that are exported to Grafana Tempo.

The implementation must be production-safe, configurable by environment variables, and compatible
with the current server startup and shutdown lifecycle in
[packages/server/src/index.ts](packages/server/src/index.ts).

## 2. Current-State Constraints

1. Server entrypoint is [packages/server/src/index.ts](packages/server/src/index.ts) and uses Node
   HTTP + GraphQL Yoga + pg Pool.
2. Environment parsing and validation is centralized in
   [packages/server/src/environment.ts](packages/server/src/environment.ts).
3. Server scripts and runtime commands are in
   [packages/server/package.json](packages/server/package.json).
4. Testing uses Vitest projects defined at root in [vitest.config.ts](vitest.config.ts), with
   server-focused test behavior in
   [packages/server/vitest.config.ts](packages/server/vitest.config.ts).
5. Graceful shutdown already exists and must be extended, not replaced, in
   [packages/server/src/index.ts](packages/server/src/index.ts).

## 3. Scope

### In scope

1. End-to-end trace pipeline from server to Tempo via OTLP.
2. Auto instrumentation for:
   1. HTTP server spans.
   2. GraphQL execution spans.
   3. PostgreSQL spans.
   4. Outbound HTTP/fetch/undici spans where applicable.
3. Configurable sampling and exporter endpoint.
4. Clean shutdown with telemetry flush.
5. Tests for config behavior and exporter pipeline behavior.
6. Developer documentation updates in [packages/server/README.md](packages/server/README.md).

### Out of scope

1. Metrics and logs ingestion through OTEL.
2. Frontend tracing.
3. Full distributed context propagation across other repos/services unless already HTTP-compatible.

## 4. Functional Requirements

1. Tracing can be enabled/disabled by config without code changes.
2. When enabled, every GraphQL request must produce at least:
   1. A root inbound HTTP span.
   2. One GraphQL operation span.
   3. Child DB spans for pg queries executed during the request.
3. Traces must include stable service metadata:
   1. service.name
   2. service.namespace
   3. service.version
   4. deployment.environment
4. Export protocol must support Tempo-compatible OTLP endpoint.
5. On SIGTERM/SIGINT and fatal process events, telemetry must flush before process exit.
6. If telemetry exporter is unreachable, business traffic must continue (fail-open default).

## 5. Non-Functional Requirements

1. Overhead target: added p95 request latency < 10% at default sampling.
2. No sensitive payload leakage in span attributes.
3. Cardinality controls on span attributes to avoid Tempo index pressure.
4. Deterministic startup behavior across local/dev/staging/prod.
5. No breaking changes to existing startup commands in
   [packages/server/package.json](packages/server/package.json).

## 6. Architecture Decisions

1. Use OpenTelemetry NodeSDK with auto instrumentations.
   1. Rationale: fastest implementation with broad ecosystem coverage.
2. Use OTLP/HTTP exporter as default for Tempo.
   1. Rationale: straightforward endpoint/path handling, firewall-friendly.
3. Initialize telemetry before importing server runtime modules.
   1. Rationale: instrumentations patch modules at import time.
4. Keep telemetry integration isolated in a dedicated telemetry bootstrap module.
   1. Rationale: clean separation and easier testability.
5. Fail-open exporter behavior by default; optional strict mode is allowed.
   1. Rationale: observability outage must not cause API outage.

## 7. Configuration Contract

Add an OTEL section in [packages/server/src/environment.ts](packages/server/src/environment.ts) that
supports at least:

1. OTEL_ENABLED: 1 or 0
2. OTEL_SERVICE_NAME: default accounter-server
3. OTEL_SERVICE_NAMESPACE: default accounter
4. OTEL_DEPLOYMENT_ENV: default from NODE_ENV fallback development
5. OTEL_EXPORTER_OTLP_ENDPOINT: required when enabled
6. OTEL_EXPORTER_OTLP_HEADERS: optional key-value header string
7. OTEL_TRACES_SAMPLER: parentbased_traceidratio or always_on
8. OTEL_TRACES_SAMPLER_ARG: numeric ratio for traceidratio
9. OTEL_EXPORT_TIMEOUT_MS: optional exporter timeout
10. OTEL_STARTUP_STRICT: optional, if true fail startup when telemetry init fails

Validation rules:

1. If OTEL_ENABLED is 1, endpoint must be present and valid.
2. Sampler arg must be numeric and within [0,1] when ratio sampler is selected.
3. Empty strings are treated as undefined (same pattern already used in environment parsing).

## 8. Runtime Flow

### Startup

1. Process starts.
2. Telemetry bootstrap module initializes NodeSDK and auto instrumentations.
3. Server modules load and start in [packages/server/src/index.ts](packages/server/src/index.ts).
4. Requests begin flowing with active tracing context.

### Request lifecycle

1. HTTP inbound span is created.
2. GraphQL operation span nested under HTTP span.
3. PG query spans nested under current operation/request context.
4. Outbound HTTP spans nested under current context where applicable.
5. Trace exported asynchronously via OTLP exporter.

### Shutdown

1. Existing graceful shutdown in [packages/server/src/index.ts](packages/server/src/index.ts) runs.
2. Telemetry SDK shutdown is called before final process exit.
3. If timeout is hit, process exits with current policy.

## 9. Data Handling and Privacy

Allowed span data:

1. Operation name
2. Operation type (query/mutation/subscription)
3. Resolver/module names when low-cardinality
4. DB system, statement type, timing, row count if available
5. HTTP method, route, status code, host/service identifiers

Disallowed by default:

1. Raw GraphQL query text
2. GraphQL variables
3. Authorization headers, cookies, tokens
4. Full SQL statement values with user data
5. Personal identifiers unless explicitly approved and redacted

Redaction strategy:

1. Central sanitizer for custom attributes.
2. Allowlist attribute keys.
3. Replace sensitive values with fixed token REDACTED.
4. Avoid high-cardinality identifiers in span attributes.

Sampling strategy:

1. Development: always_on.
2. Staging/production: parentbased_traceidratio with configurable ratio.
3. Critical endpoints can be sampled more aggressively only if explicitly configured.

## 10. Error Handling Strategy

Initialization errors:

1. If OTEL_ENABLED is 0: skip init silently with debug log.
2. If OTEL_ENABLED is 1 and OTEL_STARTUP_STRICT is false: log error and continue without tracing.
3. If OTEL_ENABLED is 1 and OTEL_STARTUP_STRICT is true: fail startup with clear error.

Exporter runtime errors:

1. Never throw into request flow.
2. Emit structured error logs with endpoint and error class.
3. Use OTEL SDK retry/backoff defaults.

Shutdown errors:

1. Telemetry shutdown failures are logged.
2. Process still exits according to existing shutdown policy in
   [packages/server/src/index.ts](packages/server/src/index.ts).

## 11. Implementation Work Breakdown

1. Dependencies
   1. Add OTEL API, SDK, auto instrumentation bundle, and OTLP exporter in
      [packages/server/package.json](packages/server/package.json).
2. Telemetry bootstrap module
   1. Create new telemetry registration module under server source tree.
   2. Build NodeSDK and exporter config from env.
   3. Expose start and shutdown hooks.
3. Startup wiring
   1. Update server start path so telemetry module is loaded before application modules.
   2. Keep current build/start flow compatible with existing scripts in
      [packages/server/package.json](packages/server/package.json).
4. Environment schema
   1. Add OTEL config parsing and validation in
      [packages/server/src/environment.ts](packages/server/src/environment.ts).
5. Graceful shutdown
   1. Integrate telemetry shutdown in [packages/server/src/index.ts](packages/server/src/index.ts).
6. GraphQL span enrichment
   1. Add safe operation metadata attributes and span naming.
7. Documentation
   1. Add OTEL setup and Tempo verification section to
      [packages/server/README.md](packages/server/README.md).

## 12. Testing Plan

### Unit tests

Target: environment parsing and telemetry config mapping.

1. OTEL disabled path returns no telemetry config.
2. OTEL enabled with valid endpoint parses successfully.
3. Invalid sampler arg fails validation.
4. Strict mode behavior is correctly interpreted.

Suggested location:

1. Server test tree under [packages/server/src/**tests**](packages/server/src/__tests__).

### Integration tests

Target: runtime behavior with mocked collector.

1. Start server with OTEL enabled and exporter endpoint pointed to local mock HTTP collector.
2. Send GraphQL request.
3. Assert collector receives at least one trace payload.
4. Assert span hierarchy includes HTTP + GraphQL + pg for DB-backed request.
5. Assert sensitive fields are absent.

Run in existing integration project defined in [vitest.config.ts](vitest.config.ts).

### Shutdown tests

1. Start server, make request, trigger graceful shutdown.
2. Assert telemetry shutdown function is invoked.
3. Assert no unhandled rejection from telemetry pipeline.

### Manual validation in Tempo

1. Configure endpoint to Tempo OTLP ingest.
2. Start server and execute representative GraphQL operations.
3. In Grafana Explore, filter by service.name.
4. Verify traces include expected nested spans and attributes.
5. Verify trace volume aligns with configured sampling ratio.

## 13. Acceptance Criteria

1. Traces are visible in Tempo for live GraphQL traffic.
2. Span hierarchy is correct and useful for troubleshooting.
3. No sensitive payloads appear in sampled spans.
4. Server startup and shutdown remain stable with and without OTEL enabled.
5. Tests covering env parsing and export pipeline pass in CI.
6. README contains setup, env keys, and validation steps in
   [packages/server/README.md](packages/server/README.md).

## 14. Rollout Plan

1. Phase 1
   1. Add bootstrap + exporter + minimal config.
   2. Validate traces in non-production.
2. Phase 2
   1. Add GraphQL enrichment and redaction rules.
   2. Tune sampling by environment.
3. Phase 3
   1. Add integration tests and documentation hardening.
   2. Enable in production with conservative sampling and monitor overhead.

## 15. Risks and Mitigations

1. Risk: Instrumentation load order incorrect.
   1. Mitigation: enforce telemetry preload before app imports.
2. Risk: Excessive trace volume.
   1. Mitigation: ratio sampling defaults and environment overrides.
3. Risk: Sensitive attribute leakage.
   1. Mitigation: explicit allowlist + sanitizer + test assertions.
4. Risk: Exporter outage impacts startup.
   1. Mitigation: fail-open default with optional strict mode.
5. Risk: Shutdown drops in-flight spans.
   1. Mitigation: explicit telemetry flush in graceful shutdown path.
