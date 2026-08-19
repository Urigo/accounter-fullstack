/**
 * Shared upstream GraphQL client used by tool handlers.
 *
 * Design constraints (spec §5.3, §8.3, §10):
 * - Reads and writes travel separate, individually guarded methods: `query`
 *   refuses anything that is not a read, and `mutate`/`mutateMultipart` refuse
 *   anything that is not a single mutation. Neither can be used to send the
 *   other kind of document, so a read tool cannot mutate and a write tool cannot
 *   smuggle an arbitrary operation.
 * - A strict timeout budget with cancellation; bounded retries for idempotent
 *   read failures only (never on auth/validation errors, and never on a write —
 *   mutations are not idempotent, so a retry could double-apply).
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

/**
 * Header carrying the resolved read scope upstream, where RLS is the actual
 * enforcement point. Mirrors
 * `packages/server/src/plugins/business-scope-header.ts`.
 */
export const BUSINESS_SCOPE_HEADER = 'x-business-scope';

/** Per-call context propagated to the upstream server. */
export interface UpstreamRequestContext {
  correlationId: string;
  /**
   * Authorization header value (`Bearer <token>`) forwarded from the
   * authenticated request. Never logged. Omitted ⇒ no header sent.
   */
  authorization?: string;
  /**
   * Resolved business read scope. Sent as `x-business-scope` so the upstream
   * server narrows via RLS.
   *
   * Omitted or empty ⇒ **no header at all**. Upstream parses an absent header
   * as "all of the caller's memberships", so emitting an empty header would
   * mean the exact opposite of "no businesses". See the guard in `executeOnce`.
   */
  businessScope?: readonly string[];
}

/**
 * A binary file sent alongside a mutation via the GraphQL multipart request
 * spec. `variablePath` is the dot path of the `null` placeholder it replaces in
 * the operation variables, e.g. `variables.documents.0`.
 */
export interface UploadFile {
  variablePath: string;
  filename: string;
  contentType: string;
  content: Uint8Array;
}

/** The body of one wire attempt, plus the headers specific to its encoding. */
interface WireBody {
  headers: Record<string, string>;
  body: BodyInit;
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

/** Strip `#` line comments so a commented-out operation cannot fool the guards. */
function stripGraphQLComments(query: string): string {
  return query.replace(/#[^\n]*/g, '');
}

// Mirror of `assertReadOnly` for the write path. A write wrapper must be just as
// unable to send an arbitrary document as a read wrapper is to send a mutation:
//  - the document must *start* with `mutation`, so a leading `query` cannot be
//    paired with a trailing mutation selected via `operationName`;
//  - `subscription` is refused outright;
//  - exactly one operation definition may be present.
// The operation count is matched per line, so a *field* named `mutation` inside a
// selection set also trips it. Over-rejecting is the safe direction here — our
// own wrappers only send single, top-level mutations.
const OPERATION_DEFINITION_RE = /^[ \t]*(query|mutation|subscription)\b/gm;

function assertSingleMutation(query: string): void {
  const stripped = stripGraphQLComments(query);
  const operations = stripped.match(OPERATION_DEFINITION_RE) ?? [];
  if (!/^\s*mutation\b/.test(stripped) || operations.length !== 1) {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      'Only a single top-level mutation may be sent on the write path',
      false,
    );
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
    return this.execute<TData>(
      () => ({
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: request.query,
          variables: request.variables ?? {},
          ...(request.operationName ? { operationName: request.operationName } : {}),
        }),
      }),
      context,
      this.maxRetries,
    );
  }

  /**
   * Execute a single mutation with a JSON body. Same timeout, headers, and error
   * sanitization as {@link query}, but **never retried**: a mutation is not
   * idempotent, so re-sending a request that may already have been applied
   * upstream could double-apply it. A timed-out or network-failed write surfaces
   * to the caller as-is, for them to decide about.
   */
  async mutate<TData>(request: GraphQLRequest, context: UpstreamRequestContext): Promise<TData> {
    assertSingleMutation(request.query);
    return this.execute<TData>(
      () => ({
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: request.query,
          variables: request.variables ?? {},
          ...(request.operationName ? { operationName: request.operationName } : {}),
        }),
      }),
      context,
      0,
    );
  }

  /**
   * Execute a single mutation carrying binary files, using the GraphQL multipart
   * request spec (which graphql-yoga implements natively upstream — there is no
   * upload plugin to route around).
   *
   * `request.variables` must already carry `null` placeholders at each file's
   * {@link UploadFile.variablePath}; this method only assembles the form. Like
   * {@link mutate} it is never retried.
   *
   * `Content-Type` is deliberately left unset: `FormData` supplies it along with
   * the generated multipart boundary, and setting it by hand would strip the
   * boundary and make the body unparseable upstream.
   */
  async mutateMultipart<TData>(
    request: GraphQLRequest,
    files: readonly UploadFile[],
    context: UpstreamRequestContext,
  ): Promise<TData> {
    assertSingleMutation(request.query);
    return this.execute<TData>(
      () => {
        const form = new FormData();
        form.set(
          'operations',
          JSON.stringify({
            query: request.query,
            variables: request.variables ?? {},
            ...(request.operationName ? { operationName: request.operationName } : {}),
          }),
        );
        form.set(
          'map',
          JSON.stringify(
            Object.fromEntries(files.map((file, index) => [String(index), [file.variablePath]])),
          ),
        );
        for (const [index, file] of files.entries()) {
          form.append(
            String(index),
            new Blob([file.content as BlobPart], { type: file.contentType }),
            file.filename,
          );
        }
        return { headers: { Accept: 'application/json' }, body: form };
      },
      context,
      0,
    );
  }

  /**
   * Shared engine: retry loop around {@link executeOnce}. `buildBody` is called
   * per attempt rather than once, so a retried request never re-sends an already
   * consumed body stream.
   */
  private async execute<TData>(
    buildBody: () => WireBody,
    context: UpstreamRequestContext,
    maxRetries: number,
  ): Promise<TData> {
    // Span covers all retry attempts; the correlation id also propagates to the
    // upstream server via the X-Correlation-Id header on each attempt.
    return withSpan('upstream:graphql', context.correlationId, async () => {
      let attempt = 0;
      // Total tries = 1 + maxRetries; only retryable failures loop.
      for (;;) {
        try {
          return await this.executeOnce<TData>(buildBody, context);
        } catch (error) {
          const isRetryable = error instanceof UpstreamError && error.retryable;
          if (!isRetryable || attempt >= maxRetries) {
            throw error;
          }
          attempt += 1;
        }
      }
    });
  }

  private async executeOnce<TData>(
    buildBody: () => WireBody,
    context: UpstreamRequestContext,
  ): Promise<TData> {
    // Build the request BEFORE arming the timeout. Two reasons: the timeout
    // budget is for the upstream exchange, not for serializing our own body; and
    // a `buildBody()` that throws (a variable that will not JSON-serialize, a
    // runtime without Blob/FormData) must not leave a live timer behind holding
    // the event loop open — it would escape the `finally` that clears it.
    const wire = buildBody();
    const headers: Record<string, string> = {
      ...wire.headers,
      'X-Correlation-Id': context.correlationId,
    };
    // Forward the caller's bearer token so upstream applies the same identity.
    if (context.authorization) {
      headers.Authorization = context.authorization;
    }
    // Forward the resolved business scope so upstream RLS narrows the request.
    //
    // Two guards, both load-bearing:
    //  - Only set the header when at least one id survives. Upstream reads an
    //    absent header as "all memberships", so an empty header would widen the
    //    scope instead of narrowing it — the exact opposite of the intent.
    //  - Filter falsy ids first, so a stray empty entry can never produce a
    //    trailing/double comma, which upstream rejects with a hard FORBIDDEN.
    const businessScope = context.businessScope?.filter(Boolean) ?? [];
    if (businessScope.length > 0) {
      headers[BUSINESS_SCOPE_HEADER] = businessScope.join(',');
    }

    // The timeout budget spans the entire exchange — obtaining the response AND
    // consuming its body — so an upstream that sends headers then stalls the body
    // is still aborted. The timer is cleared only once everything is done.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers,
          body: wire.body,
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
