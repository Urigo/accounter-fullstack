---
'@accounter/mcp-server': minor
'@accounter/server': patch
---

Export MCP server traces to OpenTelemetry (Grafana Tempo) and link them with the backend.

The MCP server's tracing was previously a dependency-free stub. It now emits real OpenTelemetry
spans over OTLP/HTTP to the same Grafana Tempo backend as the main server, using the same `OTEL_*`
configuration (disabled by default; enable with `OTEL_ENABLED=1` and an
`OTEL_EXPORTER_OTLP_ENDPOINT`). Spans come from Node auto-instrumentation (incoming `POST /mcp`, and
the outbound `fetch` to the upstream GraphQL API) plus the existing `withSpan` units of work
(`auth:verify`, `tool:<name>`, `upstream:graphql`), each tagged with an `accounter.correlation_id`
attribute.

MCP and backend traces are linked two ways: the outbound `fetch` propagates the W3C `traceparent`
header, so the Accounter server continues the same distributed trace; and a new `correlationIdPlugin`
on the server records an inbound `X-Correlation-Id` as the `accounter.correlation_id` span
attribute, so both services' traces are searchable by the same business-level id in Grafana.
