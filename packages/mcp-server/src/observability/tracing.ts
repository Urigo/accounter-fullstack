import { type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { getServiceVersion, SERVICE_NAME } from '../version.js';

/**
 * OpenTelemetry span helper (spec §11.3).
 *
 * Wraps a unit of work (auth validation, an upstream call, tool execution) in a
 * real OTEL span. The span is started as the *active* span, so:
 *  - nested `withSpan` calls (e.g. `upstream:graphql` inside `tool:<name>`) are
 *    parented correctly, and
 *  - the undici (fetch) instrumentation picks up the active context and injects
 *    the W3C `traceparent` header on the upstream call — which is what links a
 *    trace across the MCP server and the Accounter backend.
 *
 * The business-level `correlationId` (inherited from / echoed as the
 * `X-Correlation-Id` header) is attached as a span attribute so a trace can be
 * found in Grafana from an MCP log line, and cross-referenced with the same
 * attribute set on the backend spans.
 *
 * When OTEL is disabled, `trace.getTracer` returns the API's no-op tracer, so
 * this stays effectively zero-cost and the call sites need no changes.
 */

/** Span attribute carrying the business-level correlation id. */
export const CORRELATION_ID_ATTRIBUTE = 'accounter.correlation_id';

function tracer() {
  return trace.getTracer(SERVICE_NAME, getServiceVersion());
}

export async function withSpan<T>(
  name: string,
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer().startActiveSpan(name, async (span: Span) => {
    if (correlationId) {
      span.setAttribute(CORRELATION_ID_ATTRIBUTE, correlationId);
    }
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      // Record the exception on the span (name/message only — no secrets flow
      // through here) and mark it errored, then re-throw unchanged.
      const exception =
        error instanceof Error ? error : { name: 'unknown', message: String(error) };
      span.recordException(exception);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.name : 'unknown',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
