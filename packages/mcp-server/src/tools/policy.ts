import {
  resolveRequestedReadScope,
  type AuthorizedReadScope,
  type McpAuthContext,
} from '../auth/identity.js';
import type { ToolAuthPolicy, ToolDefinition } from './registry.js';

/**
 * Per-tool authorization policy evaluator (spec §7).
 *
 * Runs BEFORE a tool handler executes. It enforces the tool's required roles
 * and business-scope constraints against the caller's auth context, and applies
 * optional caller-provided scope narrowing — but only ever as a subset of the
 * caller's authorized memberships. Any request outside those memberships is
 * denied with a deterministic AUTHORIZATION_ERROR (never silently narrowed).
 */

/** Deterministic authorization error payload (spec §10.2). */
export interface AuthorizationError {
  code: 'AUTHORIZATION_ERROR';
  message: string;
}

export type PolicyDecision =
  { allowed: true; readScope: AuthorizedReadScope } | { allowed: false; error: AuthorizationError };

function deny(message: string): PolicyDecision {
  return { allowed: false, error: { code: 'AUTHORIZATION_ERROR', message } };
}

export interface EvaluatePolicyParams {
  policy: ToolAuthPolicy;
  auth: McpAuthContext;
  /** Optional caller-provided business-scope narrowing (subset of memberships). */
  requestedBusinessIds?: readonly string[];
}

/**
 * Evaluate a tool's policy for a caller. Returns the resolved read scope when
 * allowed, or an AUTHORIZATION_ERROR when denied.
 *
 * Rules:
 * - Required roles (any-of): the caller must hold at least one when the policy
 *   lists any. No list ⇒ no role gate.
 * - Requested scope narrowing must be a subset of the caller's memberships;
 *   otherwise the request is denied (not silently dropped).
 * - When the tool requires business scope, the resolved scope must be
 *   non-empty (a caller with no memberships cannot use it).
 */
export function evaluateToolPolicy(params: EvaluatePolicyParams): PolicyDecision {
  const { policy, auth, requestedBusinessIds } = params;

  // 1. Role gate (any-of).
  if (policy.requiredRoles && policy.requiredRoles.length > 0) {
    const held = new Set(auth.roles);
    if (!policy.requiredRoles.some(role => held.has(role))) {
      return deny('Caller is missing a required role for this tool');
    }
  }

  // 2. Resolve requested scope as a subset of authorized memberships.
  const readScope = resolveRequestedReadScope(auth, requestedBusinessIds);
  if (readScope === null) {
    return deny('Requested business scope is outside your authorized memberships');
  }

  // 3. Business-scope requirement.
  if (policy.requiresBusinessScope && readScope.businessIds.length === 0) {
    return deny('No authorized business scope for this request');
  }

  return { allowed: true, readScope };
}

/** Convenience: evaluate the policy of a registered tool. */
export function authorizeToolCall(
  tool: ToolDefinition,
  auth: McpAuthContext,
  requestedBusinessIds?: readonly string[],
): PolicyDecision {
  return evaluateToolPolicy({ policy: tool.policy, auth, requestedBusinessIds });
}
