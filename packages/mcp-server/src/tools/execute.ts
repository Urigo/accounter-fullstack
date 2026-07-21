import type { McpAuthContext } from '../auth/identity.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import type { UpstreamGraphQLClient } from '../upstream/graphql-client.js';
import { evaluateToolPolicy } from './policy.js';
import {
  validateToolInput,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolResult,
  type ToolValidationIssue,
} from './registry.js';

/**
 * Curated tool execution: input validation → authorization policy → handler,
 * with deterministic error mapping to the spec's error taxonomy (§10.2).
 *
 * Tool-execution failures are returned as an MCP tool result with `isError`
 * and a structured `{ code, message, correlationId, retryable? }` payload (the
 * unified error mapper in a later step formalizes this shape) rather than as
 * protocol-level JSON-RPC errors, so the model can read them.
 */

/** Machine error codes surfaced to tool callers (spec §10.2). */
export type ToolErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INTERNAL_ERROR';

/**
 * A domain-validation failure a handler can throw (e.g. cross-field bounds not
 * expressible in the input schema). Mapped to a VALIDATION_ERROR result.
 */
export class ToolInputError extends Error {
  public readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly issues?: ToolValidationIssue[],
  ) {
    super(message);
    this.name = 'ToolInputError';
  }
}

interface ToolErrorDetails {
  code: ToolErrorCode;
  message: string;
  correlationId: string;
  retryable?: boolean;
  issues?: ToolValidationIssue[];
}

/** Build an MCP tool-result error carrying the taxonomy fields. */
export function toolErrorResult(details: ToolErrorDetails): ToolResult {
  return {
    content: [{ type: 'text', text: `${details.code}: ${details.message}` }],
    isError: true,
    structuredContent: {
      code: details.code,
      message: details.message,
      correlationId: details.correlationId,
      ...(details.retryable !== undefined && { retryable: details.retryable }),
      ...(details.issues && details.issues.length > 0 && { issues: details.issues }),
    },
  };
}

/** Optional per-tool convention: an input field carrying scope narrowing. */
function requestedBusinessIds(input: unknown): string[] | undefined {
  if (input && typeof input === 'object') {
    const value = (input as { businessIds?: unknown }).businessIds;
    if (Array.isArray(value) && value.every(id => typeof id === 'string')) {
      return value as string[];
    }
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
}

/**
 * Validate, authorize, and execute a registered tool. Always resolves to a
 * {@link ToolResult} — success or a taxonomy-tagged error result.
 */
export async function executeRegisteredTool(params: ExecuteToolParams): Promise<ToolResult> {
  const { tool, rawArgs, auth, correlationId, client, authorization } = params;

  // 1. Strict input validation (unknown fields rejected).
  const validation = validateToolInput(tool, rawArgs);
  if (!validation.ok) {
    return toolErrorResult({
      code: 'VALIDATION_ERROR',
      message: validation.error.message,
      correlationId,
      issues: validation.error.issues,
    });
  }
  const input = validation.data;

  // 2. Authorization policy (roles + business scope narrowing).
  const decision = evaluateToolPolicy({
    policy: tool.policy,
    auth,
    requestedBusinessIds: requestedBusinessIds(input),
  });
  if (!decision.allowed) {
    return toolErrorResult({
      code: 'AUTHORIZATION_ERROR',
      message: decision.error.message,
      correlationId,
    });
  }

  // 3. Execute the handler.
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
    if (error instanceof ToolInputError) {
      return toolErrorResult({
        code: 'VALIDATION_ERROR',
        message: error.message,
        correlationId,
        issues: error.issues,
      });
    }
    if (error instanceof UpstreamError) {
      return toolErrorResult({
        code: error.code,
        message: error.message,
        correlationId,
        retryable: error.retryable,
      });
    }
    return toolErrorResult({
      code: 'INTERNAL_ERROR',
      message: 'Tool execution failed',
      correlationId,
    });
  }
}
