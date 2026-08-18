import type { AuthorizedReadScope, McpAuthContext } from '../auth/identity.js';
import {
  errorPayload,
  isInternalError,
  toErrorPayload,
  toToolErrorResult,
  type McpErrorCode,
} from '../errors/taxonomy.js';
import { log } from '../logger.js';
import { outcomeForCode, type Metrics, type RequestOutcome } from '../observability/metrics.js';
import { withSpan } from '../observability/tracing.js';
import { rateLimitKey, type RateLimiterLike } from '../rate-limit/limiter.js';
import type { UpstreamGraphQLClient } from '../upstream/graphql-client.js';
import { listShapeFields } from './output.js';
import { evaluateToolPolicy } from './policy.js';
import {
  validateToolInput,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolObservation,
  type ToolResult,
} from './registry.js';

/**
 * Curated tool execution: input validation → authorization policy → handler.
 *
 * Every failure is normalized through the unified error taxonomy
 * ({@link toErrorPayload}) and returned as an MCP tool result with `isError`
 * and a structured `{ code, message, correlationId, retryable }` payload rather
 * than as a protocol-level JSON-RPC error, so the model can read it.
 *
 * Every completed call also emits exactly one `tool call` usage log line (see
 * {@link TOOL_CALL_EVENT}) — on every path, including the validation,
 * authorization and rate-limit rejections that never reach a handler. The
 * per-request logs in `server.ts` cannot carry this: every MCP call is the same
 * `POST /mcp`, so the tool name, its outcome and its inputs are only knowable
 * here.
 */

// Re-exported so tool handlers can import the domain-validation error alongside
// the executor; the canonical definition lives in the error taxonomy.
export { ToolInputError } from '../errors/taxonomy.js';

/**
 * `event` discriminator on the usage log line, so tool calls can be selected out
 * of the log stream without matching on free-text messages.
 */
export const TOOL_CALL_EVENT = 'tool_call';

/**
 * Run a tool's `observe` hook without letting it affect the call.
 *
 * Telemetry is strictly secondary to serving the request: a buggy hook must not
 * turn a successful tool call into an error, so a throw is logged and dropped.
 */
function safeObserve(
  tool: ToolDefinition,
  input: Record<string, unknown>,
  result: ToolResult,
): ToolObservation | undefined {
  if (!tool.observe) {
    return undefined;
  }
  try {
    return tool.observe(input, result);
  } catch (error) {
    log('warn', 'tool observation failed', {
      tool: tool.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Optional per-tool convention: input fields carrying scope narrowing. Either a
 * `memberBusinessIds` array or a singular `memberBusinessId` string is honored.
 */
function requestedMemberBusinessIds(input: unknown): string[] | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const record = input as { memberBusinessIds?: unknown; memberBusinessId?: unknown };
  if (
    Array.isArray(record.memberBusinessIds) &&
    record.memberBusinessIds.every(id => typeof id === 'string')
  ) {
    return record.memberBusinessIds as string[];
  }
  if (typeof record.memberBusinessId === 'string') {
    return [record.memberBusinessId];
  }
  return undefined;
}

/**
 * Size-only summary of a write tool's input, for the audit log. Deliberately
 * records *how much* was touched and *which ids*, never payload content — a
 * document's bytes, filename, or MIME type must not reach the logs. Array
 * lengths and string ids are the only things extracted.
 */
function auditCounts(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      fields[`${key}Count`] = value.length;
    } else if (typeof value === 'string' && key.toLowerCase().endsWith('id')) {
      fields[key] = value;
    }
  }
  return fields;
}

export interface ExecuteToolParams {
  tool: ToolDefinition;
  rawArgs: unknown;
  auth: McpAuthContext;
  correlationId: string;
  client: UpstreamGraphQLClient;
  authorization?: string;
  /** Optional rate limiter; when provided, enforced before the handler runs. */
  limiter?: RateLimiterLike;
  /** Optional metrics registry; when provided, records outcome + latency. */
  metrics?: Metrics;
}

/** The error taxonomy codes that map to a known request outcome. */
const KNOWN_ERROR_CODES = new Set<string>([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'UPSTREAM_ERROR',
  'TIMEOUT_ERROR',
  'RATE_LIMIT_ERROR',
  'INTERNAL_ERROR',
]);

/** Derive the metrics outcome label from a finished tool result. */
function outcomeOf(result: ToolResult): RequestOutcome {
  if (!result.isError) {
    return 'success';
  }
  const code = (result.structuredContent as { code?: string } | undefined)?.code;
  // Guard against a handler returning `isError` with a non-taxonomy code: fall
  // back to `internal_error` rather than recording a `<tool>|undefined` key.
  return code && KNOWN_ERROR_CODES.has(code)
    ? outcomeForCode(code as McpErrorCode)
    : 'internal_error';
}

/**
 * Validate, authorize, and execute a registered tool. Always resolves to a
 * {@link ToolResult} — success or a taxonomy-tagged error result. Records
 * request outcome, latency, and error-category metrics when a registry is
 * provided.
 */
export async function executeRegisteredTool(params: ExecuteToolParams): Promise<ToolResult> {
  const { metrics, tool } = params;
  const start = performance.now();
  const { result, input, readScope } = await runTool(params);
  const latencyMs = Math.round(performance.now() - start);
  const outcome = outcomeOf(result);

  if (metrics) {
    metrics.recordRequest(tool.name, outcome, latencyMs);
    if (outcome === 'rate_limited') {
      metrics.recordRateLimited();
    } else if (outcome === 'upstream_error' || outcome === 'timeout_error') {
      metrics.recordUpstreamError(outcome);
    }
  }

  // Only observe a call that actually ran a handler: `input` is undefined when
  // validation, policy or the rate limiter rejected it, and a hook reading an
  // input that was never parsed would be reporting fiction.
  const observation = input === undefined ? undefined : safeObserve(tool, input, result);

  // Tool-contributed fields are spread first so the canonical fields below
  // always win a name collision — cf. `completionFields` and `shapeListResult`.
  // A tool cannot misreport its own name, outcome, or caller.
  log('info', 'tool call', {
    ...observation?.fields,
    ...listShapeFields(result),
    event: TOOL_CALL_EVENT,
    tool: tool.name,
    outcome,
    latencyMs,
    userId: params.auth.userId,
    correlationId: params.correlationId,
    businessScopeSize: readScope?.memberBusinessIds.length,
    isError: result.isError === true,
  });

  for (const [counter, label] of observation?.counters ?? []) {
    metrics?.recordLabeled(counter, label);
  }

  return result;
}

/**
 * A finished run plus the context the usage log needs.
 *
 * The two optional fields are populated at different points on purpose, so they
 * are not interchangeable signals:
 *
 * - `readScope` is present as soon as the policy resolved a scope — including on
 *   a rate-limit rejection, where the scope is real and worth logging even
 *   though nothing ran. It is absent only for a validation or authorization
 *   rejection, where no scope was ever resolved.
 * - `input` is present only when a handler actually executed, which is precisely
 *   what gates `observe`: a hook reporting on a call that was rejected before
 *   its handler would be describing work that never happened. A rate-limited
 *   call therefore carries `readScope` but no `input`.
 */
interface ToolRun {
  result: ToolResult;
  input?: Record<string, unknown>;
  readScope?: AuthorizedReadScope;
}

async function runTool(params: ExecuteToolParams): Promise<ToolRun> {
  const { tool, rawArgs, auth, correlationId, client, authorization, limiter } = params;

  // 1. Strict input validation (unknown fields rejected).
  const validation = validateToolInput(tool, rawArgs);
  if (!validation.ok) {
    return {
      result: toToolErrorResult(
        errorPayload('VALIDATION_ERROR', validation.error.message, correlationId, {
          issues: validation.error.issues,
        }),
      ),
    };
  }
  const input = validation.data;

  // 2. Authorization policy (roles + business scope narrowing).
  const decision = evaluateToolPolicy({
    policy: tool.policy,
    auth,
    requestedMemberBusinessIds: requestedMemberBusinessIds(input),
  });
  if (!decision.allowed) {
    return {
      result: toToolErrorResult(
        errorPayload('AUTHORIZATION_ERROR', decision.error.message, correlationId),
      ),
    };
  }

  // 3. Rate limit (before any expensive upstream call), keyed by identity +
  // tool. Business scope is intentionally left out of the key — every subset is
  // already authorized, so keying on it would let a caller multiply their quota
  // across scope subsets (see `rateLimitKey`).
  if (limiter) {
    const outcome = limiter.check(
      rateLimitKey({
        userId: auth.userId,
        toolName: tool.name,
      }),
    );
    if (!outcome.allowed) {
      const retryAfterSeconds = Math.ceil(outcome.retryAfterMs / 1000);
      return {
        result: toToolErrorResult(
          errorPayload(
            'RATE_LIMIT_ERROR',
            `Rate limit exceeded. Retry in ${retryAfterSeconds}s.`,
            correlationId,
            { retryAfterMs: outcome.retryAfterMs },
          ),
        ),
        readScope: decision.readScope,
      };
    }
  }

  // 4. Audit the write. Mutating tools are logged BEFORE the handler runs, so a
  // call that then times out or crashes still leaves a record that it was
  // attempted — the opposite ordering would lose exactly the calls worth
  // investigating. Only identifiers and counts are recorded: never file
  // contents, never the token.
  if (tool.policy.mutating) {
    log('info', 'mutating tool invoked', {
      audit: true,
      tool: tool.name,
      userId: auth.userId,
      correlationId,
      // Guaranteed to be exactly one id by the single-write-target policy rule.
      writeTargetBusinessId: decision.readScope.memberBusinessIds[0],
      ...auditCounts(input),
    });
  }

  // 5. Execute the handler.
  //
  // `upstream` is built here, where the resolved read scope is known, so a
  // handler cannot forget to forward `x-business-scope` — it only has to pass
  // `context.upstream` through to `client.query`/`client.mutate`.
  const context: ToolExecutionContext = {
    auth,
    readScope: decision.readScope,
    correlationId,
    client,
    authorization,
    upstream: {
      correlationId,
      authorization,
      businessScope: decision.readScope.memberBusinessIds,
    },
  };
  try {
    // Span covers the handler + its upstream calls for tracing.
    const result = await withSpan(`tool:${tool.name}`, correlationId, async () =>
      tool.handler(input, context),
    );
    return { result, input, readScope: decision.readScope };
  } catch (error) {
    // Log unexpected (unmapped) failures so bugs aren't hidden; the caller only
    // ever sees the generic, sanitized INTERNAL_ERROR message.
    if (isInternalError(error)) {
      log('error', 'unexpected error during tool execution', {
        tool: tool.name,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return {
      result: toToolErrorResult(toErrorPayload(error, correlationId)),
      input,
      readScope: decision.readScope,
    };
  }
}
