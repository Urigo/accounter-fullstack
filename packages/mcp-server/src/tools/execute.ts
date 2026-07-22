import type { McpAuthContext } from '../auth/identity.js';
import {
  errorPayload,
  isInternalError,
  toErrorPayload,
  toToolErrorResult,
} from '../errors/taxonomy.js';
import { log } from '../logger.js';
import { rateLimitKey, type RateLimiterLike } from '../rate-limit/limiter.js';
import type { UpstreamGraphQLClient } from '../upstream/graphql-client.js';
import { evaluateToolPolicy } from './policy.js';
import {
  validateToolInput,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolResult,
} from './registry.js';

/**
 * Curated tool execution: input validation → authorization policy → handler.
 *
 * Every failure is normalized through the unified error taxonomy
 * ({@link toErrorPayload}) and returned as an MCP tool result with `isError`
 * and a structured `{ code, message, correlationId, retryable }` payload rather
 * than as a protocol-level JSON-RPC error, so the model can read it.
 */

// Re-exported so tool handlers can import the domain-validation error alongside
// the executor; the canonical definition lives in the error taxonomy.
export { ToolInputError } from '../errors/taxonomy.js';

/**
 * Optional per-tool convention: input fields carrying scope narrowing. Either a
 * `businessIds` array or a singular `businessId` string is honored.
 */
function requestedBusinessIds(input: unknown): string[] | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const record = input as { businessIds?: unknown; businessId?: unknown };
  if (Array.isArray(record.businessIds) && record.businessIds.every(id => typeof id === 'string')) {
    return record.businessIds as string[];
  }
  if (typeof record.businessId === 'string') {
    return [record.businessId];
  }
  return undefined;
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
}

/**
 * Validate, authorize, and execute a registered tool. Always resolves to a
 * {@link ToolResult} — success or a taxonomy-tagged error result.
 */
export async function executeRegisteredTool(params: ExecuteToolParams): Promise<ToolResult> {
  const { tool, rawArgs, auth, correlationId, client, authorization, limiter } = params;

  // 1. Strict input validation (unknown fields rejected).
  const validation = validateToolInput(tool, rawArgs);
  if (!validation.ok) {
    return toToolErrorResult(
      errorPayload('VALIDATION_ERROR', validation.error.message, correlationId, {
        issues: validation.error.issues,
      }),
    );
  }
  const input = validation.data;

  // 2. Authorization policy (roles + business scope narrowing).
  const decision = evaluateToolPolicy({
    policy: tool.policy,
    auth,
    requestedBusinessIds: requestedBusinessIds(input),
  });
  if (!decision.allowed) {
    return toToolErrorResult(
      errorPayload('AUTHORIZATION_ERROR', decision.error.message, correlationId),
    );
  }

  // 3. Rate limit (before any expensive upstream call), keyed by
  // identity + business scope + tool.
  if (limiter) {
    const outcome = limiter.check(
      rateLimitKey({
        userId: auth.userId,
        toolName: tool.name,
        businessIds: decision.readScope.businessIds,
      }),
    );
    if (!outcome.allowed) {
      const retryAfterSeconds = Math.ceil(outcome.retryAfterMs / 1000);
      return toToolErrorResult(
        errorPayload(
          'RATE_LIMIT_ERROR',
          `Rate limit exceeded. Retry in ${retryAfterSeconds}s.`,
          correlationId,
          { retryAfterMs: outcome.retryAfterMs },
        ),
      );
    }
  }

  // 4. Execute the handler.
  const context: ToolExecutionContext = {
    auth,
    readScope: decision.readScope,
    correlationId,
    client,
    authorization,
  };
  try {
    return await tool.handler(input, context);
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
    return toToolErrorResult(toErrorPayload(error, correlationId));
  }
}
