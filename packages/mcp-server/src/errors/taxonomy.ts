import { TokenVerificationError } from '../auth/token.js';
import type { ToolResult, ToolValidationIssue } from '../tools/registry.js';
import { UpstreamError } from '../upstream/graphql-client.js';

/**
 * Unified error taxonomy and mapper (spec §10.2).
 *
 * Every failure surfaced to a caller is normalized to one machine {@link
 * McpErrorCode} with a business-safe message, the request correlation id, and a
 * retryability hint. Stack traces and internal/SQL details are never included.
 * All error sources (validation, auth, policy, upstream, rate limiting, and
 * unexpected failures) map through {@link toErrorPayload}.
 */

export type McpErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INTERNAL_ERROR';

/** Default retryability per code (transient failures are retryable). */
export const DEFAULT_RETRYABLE: Record<McpErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  AUTHENTICATION_ERROR: false,
  AUTHORIZATION_ERROR: false,
  UPSTREAM_ERROR: false,
  TIMEOUT_ERROR: true,
  RATE_LIMIT_ERROR: true,
  INTERNAL_ERROR: false,
};

/** Normalized, business-safe error payload returned to callers. */
export interface McpErrorPayload {
  code: McpErrorCode;
  /** Human-readable message safe to show end users (no internal detail). */
  message: string;
  correlationId: string;
  /** Whether the caller may retry the same request. */
  retryable: boolean;
  /** Field-level issues for VALIDATION_ERROR. */
  issues?: ToolValidationIssue[];
  /** Suggested wait before retrying (rate limiting / backoff). */
  retryAfterMs?: number;
}

export interface McpErrorOptions {
  retryable?: boolean;
  issues?: ToolValidationIssue[];
  retryAfterMs?: number;
}

/** Base error carrying a taxonomy code. Thrown by layers that fail loudly. */
export class McpError extends Error {
  public readonly code: McpErrorCode;
  public readonly retryable: boolean;
  public readonly issues?: ToolValidationIssue[];
  public readonly retryAfterMs?: number;

  constructor(code: McpErrorCode, message: string, options: McpErrorOptions = {}) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE[code];
    this.issues = options.issues;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/**
 * A domain-validation failure a handler can throw (e.g. cross-field bounds not
 * expressible in the input schema). Maps to VALIDATION_ERROR.
 */
export class ToolInputError extends McpError {
  constructor(message: string, issues?: ToolValidationIssue[]) {
    super('VALIDATION_ERROR', message, { issues });
    this.name = 'ToolInputError';
  }
}

/** Raised when a caller exceeds a rate limit. Maps to RATE_LIMIT_ERROR. */
export class RateLimitError extends McpError {
  constructor(message: string, retryAfterMs: number) {
    super('RATE_LIMIT_ERROR', message, { retryable: true, retryAfterMs });
    this.name = 'RateLimitError';
  }
}

const SAFE_INTERNAL_MESSAGE = 'An internal error occurred';

function withOptionalFields(payload: McpErrorPayload): McpErrorPayload {
  const result: McpErrorPayload = {
    code: payload.code,
    message: payload.message,
    correlationId: payload.correlationId,
    retryable: payload.retryable,
  };
  if (payload.issues && payload.issues.length > 0) {
    result.issues = payload.issues;
  }
  if (payload.retryAfterMs !== undefined) {
    result.retryAfterMs = payload.retryAfterMs;
  }
  return result;
}

/** Build a payload from explicit fields, defaulting retryability by code. */
export function errorPayload(
  code: McpErrorCode,
  message: string,
  correlationId: string,
  options: McpErrorOptions = {},
): McpErrorPayload {
  return withOptionalFields({
    code,
    message,
    correlationId,
    retryable: options.retryable ?? DEFAULT_RETRYABLE[code],
    issues: options.issues,
    retryAfterMs: options.retryAfterMs,
  });
}

/**
 * Map any error source into the taxonomy. Known errors keep their code and
 * message; anything else becomes an INTERNAL_ERROR with a generic message so no
 * stack trace or internal detail leaks.
 */
export function toErrorPayload(error: unknown, correlationId: string): McpErrorPayload {
  if (error instanceof McpError) {
    return withOptionalFields({
      code: error.code,
      message: error.message,
      correlationId,
      retryable: error.retryable,
      issues: error.issues,
      retryAfterMs: error.retryAfterMs,
    });
  }
  if (error instanceof UpstreamError) {
    return errorPayload(error.code, error.message, correlationId, { retryable: error.retryable });
  }
  if (error instanceof TokenVerificationError) {
    return errorPayload('AUTHENTICATION_ERROR', error.message, correlationId);
  }
  return errorPayload('INTERNAL_ERROR', SAFE_INTERNAL_MESSAGE, correlationId);
}

/** Whether an error maps to INTERNAL_ERROR (i.e. it is unexpected/unmapped). */
export function isInternalError(error: unknown): boolean {
  return !(
    error instanceof McpError ||
    error instanceof UpstreamError ||
    error instanceof TokenVerificationError
  );
}

/** Render an error payload as an MCP tool result (`isError: true`). */
export function toToolErrorResult(payload: McpErrorPayload): ToolResult {
  return {
    content: [{ type: 'text', text: `${payload.code}: ${payload.message}` }],
    isError: true,
    structuredContent: withOptionalFields(payload),
  };
}
