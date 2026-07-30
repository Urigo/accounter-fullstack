/**
 * Shared upstream GraphQL client used by tool handlers.
 *
 * Design constraints (spec §5.3, §8.3, §10):
 * - Phase 1 is read-only: mutations/subscriptions are refused.
 * - No generic "execute anything" is exposed to tools — tools call typed
 *   read-only operation wrappers built on `createReadOperation`, never this
 *   engine directly.
 * - A strict timeout budget with cancellation; bounded retries for idempotent
 *   read failures only (never on auth/validation errors).
 * - The correlation id and the caller's Authorization header are propagated
 *   upstream; the raw token is never logged or persisted.
 * - Upstream errors are sanitized (no stack traces / internal SQL details).
 */

import { withSpan } from '../observability/tracing.js';

export type UpstreamErrorCode = 'UPSTREAM_ERROR' | 'TIMEOUT_ERROR';

/**
 * Sanitized upstream failure. Its `message` is business-safe: it never carries
 * upstream stack traces, SQL, or other internal upstream details. (Like any JS
 * Error it still has a local `.stack` for this call site — that's ours, not the
 * upstream's internals.)
 */
export class UpstreamError extends Error {
  constructor(
    public readonly code: UpstreamErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface GraphQLRequest<TVariables = Record<string, unknown>> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}

/** Per-call context propagated to the upstream server. */
export interface UpstreamRequestContext {
  correlationId: string;
  /**
   * Authorization header value (`Bearer <token>`) forwarded from the
   * authenticated request. Never logged. Omitted ⇒ no header sent.
   */
  authorization?: string;
}

export interface UpstreamClientConfig {
  endpoint: string;
  timeoutMs: number;
  /** Max retry attempts for idempotent read failures (default 2). */
  maxRetries?: number;
  /** Injectable fetch (defaults to global fetch) for testing. */
  fetchImpl?: typeof fetch;
}

interface GraphQLResponseBody<TData> {
  data?: TData;
  errors?: Array<{ message?: unknown }>;
}

// Reject a `mutation`/`subscription` keyword anywhere in the document, not just
// at the start — a multi-operation document could otherwise smuggle a mutation
// past a leading `query` and select it via `operationName`. Our own wrappers only
// send read queries, so over-rejecting here is a safe default.
const NON_READ_OPERATION_RE = /\b(mutation|subscription)\b/i;

function assertReadOnly(query: string): void {
  if (NON_READ_OPERATION_RE.test(query)) {
    throw new UpstreamError('UPSTREAM_ERROR', 'Only read-only operations are permitted', false);
  }
}

/** Max characters kept per individual upstream error message. */
const MAX_ERROR_MESSAGE_LENGTH = 200;
/** Max characters for the combined sanitized error string. */
const MAX_SANITIZED_ERROR_LENGTH = 500;

/** Collapse GraphQL error messages into a single business-safe string. */
function sanitizeGraphQLErrors(errors: Array<{ message?: unknown }>): string {
  const messages = errors
    .map(error =>
      error && typeof error === 'object' && typeof error.message === 'string' ? error.message : '',
    )
    // Normalize whitespace (collapse newlines/tabs/runs of spaces) and cap each
    // message so a verbose upstream error can neither bloat logs nor smuggle
    // multi-line internal detail into the business-safe summary.
    .map(message => message.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_MESSAGE_LENGTH))
    .filter(Boolean)
    .slice(0, 3);
  if (messages.length === 0) {
    return 'Upstream GraphQL error';
  }
  return messages.join('; ').slice(0, MAX_SANITIZED_ERROR_LENGTH);
}

export class UpstreamGraphQLClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: UpstreamClientConfig) {
    this.endpoint = config.endpoint;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  /**
   * Execute a read-only GraphQL operation with timeout, bounded retries, header
   * propagation, and error sanitization. Internal engine — tools use typed
   * wrappers ({@link createReadOperation}), not this method directly.
   */
  async query<TData>(request: GraphQLRequest, context: UpstreamRequestContext): Promise<TData> {
    assertReadOnly(request.query);

    // Span covers all retry attempts; the correlation id also propagates to the
    // upstream server via the X-Correlation-Id header on each attempt.
    return withSpan('upstream:graphql', context.correlationId, async () => {
      let attempt = 0;
      // Total tries = 1 + maxRetries; only retryable failures loop.
      for (;;) {
        try {
          return await this.executeOnce<TData>(request, context);
        } catch (error) {
          const isRetryable = error instanceof UpstreamError && error.retryable;
          if (!isRetryable || attempt >= this.maxRetries) {
            throw error;
          }
          attempt += 1;
        }
      }
    });
  }

  private async executeOnce<TData>(
    request: GraphQLRequest,
    context: UpstreamRequestContext,
  ): Promise<TData> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Correlation-Id': context.correlationId,
    };
    // Forward the caller's bearer token so upstream applies the same identity.
    if (context.authorization) {
      headers.Authorization = context.authorization;
    }

    // The timeout budget spans the entire exchange — obtaining the response AND
    // consuming its body — so an upstream that sends headers then stalls the body
    // is still aborted. The timer is cleared only once everything is done.
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: request.query,
            variables: request.variables ?? {},
            ...(request.operationName ? { operationName: request.operationName } : {}),
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new UpstreamError('TIMEOUT_ERROR', 'Upstream request timed out', true);
        }
        // Network/connection error — a read may be safely retried.
        throw new UpstreamError('UPSTREAM_ERROR', 'Upstream request failed', true);
      }

      if (!response.ok) {
        // 5xx is transient (retryable); 4xx (auth/validation) is not.
        const retryable = response.status >= 500;
        throw new UpstreamError(
          'UPSTREAM_ERROR',
          `Upstream responded with status ${response.status}`,
          retryable,
        );
      }

      let body: GraphQLResponseBody<TData>;
      try {
        body = (await response.json()) as GraphQLResponseBody<TData>;
      } catch (error) {
        // An abort raised while streaming the body is a timeout, not a malformed
        // body — classify it as a retryable TIMEOUT_ERROR.
        if (error instanceof Error && error.name === 'AbortError') {
          throw new UpstreamError('TIMEOUT_ERROR', 'Upstream request timed out', true);
        }
        // Non-JSON body (e.g. an HTML error page) — sanitize rather than leak.
        throw new UpstreamError('UPSTREAM_ERROR', 'Upstream returned a non-JSON response', false);
      }
      if (!body || typeof body !== 'object') {
        throw new UpstreamError(
          'UPSTREAM_ERROR',
          'Upstream returned an invalid response body',
          false,
        );
      }
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        // GraphQL-level errors are not retried (not transient).
        throw new UpstreamError('UPSTREAM_ERROR', sanitizeGraphQLErrors(body.errors), false);
      }
      if (body.data === undefined) {
        throw new UpstreamError('UPSTREAM_ERROR', 'Upstream returned no data', false);
      }
      return body.data;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Build a typed, read-only operation wrapper. This is the ONLY surface tool
 * handlers use to talk to the upstream — there is no generic execute exposed to
 * tools. `map` shapes the raw GraphQL data into the tool's return type.
 */
export function createReadOperation<TData, TVariables extends Record<string, unknown>, TResult>(
  query: string,
  map: (data: TData) => TResult,
): (
  client: UpstreamGraphQLClient,
  variables: TVariables,
  context: UpstreamRequestContext,
) => Promise<TResult> {
  return async (client, variables, context) => {
    const data = await client.query<TData>({ query, variables }, context);
    return map(data);
  };
}
