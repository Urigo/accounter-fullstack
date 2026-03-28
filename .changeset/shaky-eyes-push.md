---
'@accounter/server': patch
---

* **OpenTelemetry Integration**: Implemented OpenTelemetry tracing for the server, enabling observability for GraphQL requests, PostgreSQL queries, and outbound HTTP calls.
* **Configuration & Bootstrapping**: Added comprehensive environment variable configuration with Zod validation and a dedicated bootstrap module to ensure telemetry initializes before application startup.
* **Graceful Shutdown**: Integrated telemetry shutdown into the server's lifecycle to ensure all spans are flushed before process exit.
* **Testing & Documentation**: Added unit tests for environment configuration, integration tests for the telemetry pipeline, and updated the README with observability setup instructions.
