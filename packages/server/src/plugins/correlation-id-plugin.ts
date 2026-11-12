import { randomUUID } from 'node:crypto';
import { Plugin } from 'graphql-yoga';
import { isSpanContextValid, trace } from '@opentelemetry/api';

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

/** Request id set by a proxy or load balancer in front of the server, when there is one. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * What an inbound request or correlation id must look like to be used as-is. Anything else is
 * ignored (a request id is minted instead): a client must not be able to plant an id that collides
 * with a real one, or smuggle arbitrary text into every log line of a request.
 */
const VALID_ID = /^[A-Za-z0-9._:-]{8,64}$/;

const requestIds = new WeakMap<Request, string>();

/**
 * The id that ties together every log line of one request: the `graphql-operation` line, its
 * `graphql-error` lines and the DB lines (leak reclaimed, session killed).
 *
 * Taken from a valid `X-Request-Id`, else the OTel trace id (so the line pivots to the trace), else a random
 * UUID. Memoized per request, so every caller gets the same id even when it falls back to a random
 * one. Not `X-Correlation-Id`: that one deliberately spans hops (the MCP server sends the same id
 * on every upstream call of a tool run, retries included), so it can't tell one request from
 * another. It is logged as its own field instead; see {@link correlationIdOf}.
 */
export function requestIdOf(request: Request | undefined): string {
  if (!request) {
    return currentTraceId() ?? randomUUID();
  }
  let id = requestIds.get(request);
  if (!id) {
    id = headerId(request, REQUEST_ID_HEADER) ?? currentTraceId() ?? randomUUID();
    requestIds.set(request, id);
  }
  return id;
}

/** The inbound `X-Correlation-Id`, which groups the requests of one multi-hop operation, if valid. */
export function correlationIdOf(request: Request | undefined): string | null {
  return (request && headerId(request, CORRELATION_ID_HEADER)) ?? null;
}

function headerId(request: Request, header: string): string | undefined {
  const value = request.headers?.get(header)?.trim();
  return value && VALID_ID.test(value) ? value : undefined;
}

function currentTraceId(): string | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext && isSpanContextValid(spanContext) ? spanContext.traceId : undefined;
}

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
 * A no-op when the header is absent or malformed (see `correlationIdOf`), or when OTEL is disabled
 * (no active span).
 */
export function correlationIdPlugin(): Plugin {
  return {
    onRequest({ request }) {
      const correlationId = correlationIdOf(request);
      if (!correlationId) {
        return;
      }
      trace.getActiveSpan()?.setAttribute(CORRELATION_ID_ATTRIBUTE, correlationId);
    },
  };
}
