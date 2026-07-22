import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/**
 * Per-request context for observability.
 *
 * A `requestId` is minted fresh for every request. A `correlationId` is taken
 * from the inbound `x-correlation-id` header when present (so a trace can span
 * multiple hops) and otherwise generated. The correlation id is echoed back on
 * the response and propagated to upstream calls in later steps.
 */
export interface RequestContext {
  /** Unique id for this single request. */
  requestId: string;
  /** Trace id spanning hops; inherited from the inbound header when present. */
  correlationId: string;
  /** HTTP method (e.g. GET, POST). */
  method: string;
  /** Request path (pathname only — never the query string). */
  route: string;
  /** High-resolution start timestamp (ms) for latency measurement. */
  startTimeMs: number;
}

/** Header used to inherit/propagate the correlation id. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function generateId(): string {
  return randomUUID();
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Extract the pathname from a request URL, dropping the query string. Falls back
 * to a manual split if the URL is malformed (so a bad `req.url` can never throw
 * out of context creation and hang the request).
 */
function extractRoute(rawUrl: string | undefined): string {
  const url = rawUrl ?? '/';
  try {
    // Only the pathname is retained; the host is a placeholder and the query
    // string is dropped so we never log sensitive query params.
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url.split('?')[0];
  }
}

/** Build a fresh {@link RequestContext} from an incoming request. */
export function createRequestContext(req: IncomingMessage): RequestContext {
  const inboundCorrelationId = headerValue(req, CORRELATION_ID_HEADER)?.trim();
  const route = extractRoute(req.url);
  return {
    requestId: generateId(),
    correlationId: inboundCorrelationId || generateId(),
    method: req.method ?? 'UNKNOWN',
    route,
    startTimeMs: performance.now(),
  };
}

/** Elapsed time since the context was created, in whole milliseconds. */
export function elapsedMs(context: RequestContext): number {
  return Math.round(performance.now() - context.startTimeMs);
}

// Associate a context with its request without mutating the request's type.
const contextByRequest = new WeakMap<IncomingMessage, RequestContext>();

export function setRequestContext(req: IncomingMessage, context: RequestContext): void {
  contextByRequest.set(req, context);
}

export function getRequestContext(req: IncomingMessage): RequestContext | undefined {
  return contextByRequest.get(req);
}
