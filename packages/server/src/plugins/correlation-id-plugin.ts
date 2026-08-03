import { Plugin } from 'graphql-yoga';
import { trace } from '@opentelemetry/api';

/**
 * Request header carrying a business-level correlation id across service hops.
 * The MCP server (`@accounter/mcp-server`) mints/inherits this id and forwards
 * it on every upstream GraphQL call.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Span attribute name for the correlation id. Kept identical to the attribute
 * the MCP server sets on its own spans (`accounter.correlation_id`) so a single
 * Grafana/Tempo query surfaces the matching spans on both services.
 */
export const CORRELATION_ID_ATTRIBUTE = 'accounter.correlation_id';

/**
 * CorrelationIdPlugin — bridges an inbound `X-Correlation-Id` header onto the
 * current OpenTelemetry trace.
 *
 * The actual MCP↔backend trace linkage rides the W3C `traceparent` header
 * (auto-propagated by the MCP server's fetch instrumentation and extracted by
 * this server's HTTP instrumentation). This plugin adds the human-friendly
 * correlation id as a searchable attribute on the active (HTTP server) span, so
 * an operator can pivot from an MCP log line to the backend trace, and search
 * traces by the business-level id.
 *
 * A no-op when the header is absent or when OTEL is disabled (no active span).
 */
export function correlationIdPlugin(): Plugin {
  return {
    onRequest({ request }) {
      const correlationId = request.headers.get(CORRELATION_ID_HEADER)?.trim();
      if (!correlationId) {
        return;
      }
      trace.getActiveSpan()?.setAttribute(CORRELATION_ID_ATTRIBUTE, correlationId);
    },
  };
}
