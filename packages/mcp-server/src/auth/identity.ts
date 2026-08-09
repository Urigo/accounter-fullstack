import type { IncomingMessage } from 'node:http';
import type { AuthPrincipal } from './token.js';

/**
 * Identity mapping: verified token → internal user + business membership context.
 *
 * The membership / read-scope shapes and rules mirror the server package
 * (`packages/server/src/shared/types/auth.ts` and `shared/helpers/auth-scope.ts`)
 * so the connector enforces the same tenant-isolation model. They are mirrored
 * rather than imported to keep this package standalone; a shared `@accounter/auth`
 * package would let both consume one source of truth.
 *
 * Phase 1 is read-only: no write-target resolution is performed here.
 */

/** A single business the user belongs to, with the role they hold in it. */
export interface BusinessMembership {
  /** Id of the business this membership is in. */
  memberBusinessId: string;
  roleId: string;
  /**
   * Human-readable business name, for display in the discovery tool. Absent or
   * `null` when upstream has no name — never load-bearing for authorization.
   */
  businessName?: string | null;
}

/** The set of businesses a request is authorized to read from. */
export interface AuthorizedReadScope {
  /** Ids of the member businesses this request may read from. */
  memberBusinessIds: string[];
}

/** Internal auth context derived from a verified access token. */
export interface McpAuthContext {
  /** Stable user id (token `sub`). */
  userId: string;
  /** Auth0 user id (same as `sub` for Auth0-issued tokens). */
  auth0UserId: string;
  email: string | null;
  /** Granted roles/scopes from the token. */
  roles: readonly string[];
  /** All businesses the user belongs to. */
  memberships: readonly BusinessMembership[];
  /** Default read scope = every business the user belongs to. */
  defaultReadScope: AuthorizedReadScope;
  /** The verified principal this context was built from. */
  principal: AuthPrincipal;
}

/** Raised when a verified token cannot be mapped to a valid user. */
export class IdentityMappingError extends Error {
  public readonly code = 'identity_unresolved';

  constructor(message: string) {
    super(message);
    this.name = 'IdentityMappingError';
  }
}

/**
 * Default read scope = every business the user belongs to, de-duplicated and
 * order-preserving. Mirrors the server's `readScopeFromMemberships`.
 */
export function readScopeFromMemberships(
  memberships: readonly BusinessMembership[],
): AuthorizedReadScope {
  return { memberBusinessIds: [...new Set(memberships.map(m => m.memberBusinessId))] };
}

/**
 * Narrow a user's memberships to a requested set of business ids. Returns the
 * requested ids (de-duplicated, request order preserved) as the read scope, or
 * `null` if ANY requested id is outside the user's memberships — callers must
 * reject rather than silently dropping unknown ids. Mirrors the server's
 * `narrowReadScope`.
 */
export function narrowReadScope(
  memberships: readonly BusinessMembership[],
  requestedMemberBusinessIds: readonly string[],
): AuthorizedReadScope | null {
  const allowed = new Set(memberships.map(m => m.memberBusinessId));
  const seen = new Set<string>();
  const memberBusinessIds: string[] = [];
  for (const memberBusinessId of requestedMemberBusinessIds) {
    if (!allowed.has(memberBusinessId)) {
      return null;
    }
    if (!seen.has(memberBusinessId)) {
      seen.add(memberBusinessId);
      memberBusinessIds.push(memberBusinessId);
    }
  }
  return { memberBusinessIds };
}

/**
 * Resolve the effective read scope for a request: no requested ids ⇒ the
 * default (all memberships); otherwise the requested subset, or `null` when any
 * requested id falls outside the user's memberships.
 */
export function resolveRequestedReadScope(
  context: McpAuthContext,
  requestedMemberBusinessIds?: readonly string[],
): AuthorizedReadScope | null {
  if (!requestedMemberBusinessIds || requestedMemberBusinessIds.length === 0) {
    return context.defaultReadScope;
  }
  return narrowReadScope(context.memberships, requestedMemberBusinessIds);
}

/**
 * Custom claim carrying the user's business memberships. Auth0 must be
 * configured to emit it (via a login/enrichment action). Entries accept either
 * camelCase or snake_case keys.
 */
export const MEMBERSHIPS_CLAIM = 'memberships';

/** A function that resolves a principal's memberships (claims, upstream, …). */
export type MembershipSource = (
  principal: AuthPrincipal,
) => readonly BusinessMembership[] | Promise<readonly BusinessMembership[]>;

/**
 * Coerce a single raw membership entry (a token claim entry or a
 * `myMemberships` GraphQL row) into the internal {@link BusinessMembership}
 * shape, or `null` when it is not a usable membership. Exported so the upstream
 * membership source (which resolves memberships from the server) maps rows the
 * same way the claims source does.
 */
export function coerceMembership(entry: unknown): BusinessMembership | null {
  // Arrays are objects too; exclude them and any non-object claim entries.
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  // Raw payload keys, deliberately NOT renamed: these are the shapes the token
  // claim and the upstream `myMemberships` row arrive in. Only the internal
  // field the value is mapped onto carries this package's `memberBusinessId`
  // vocabulary.
  const businessId = record.businessId ?? record.business_id;
  if (typeof businessId !== 'string' || businessId.length === 0) {
    return null;
  }
  // The role may be absent (treated as an empty role). But a *present* role of a
  // non-primitive type (object/array/boolean) marks a malformed entry: reject it
  // outright rather than coercing to '' and letting a bad claim still contribute
  // its business id to the derived read scope.
  const rawRoleId = record.roleId ?? record.role_id;
  let roleId: string;
  if (rawRoleId === undefined || rawRoleId === null) {
    roleId = '';
  } else if (typeof rawRoleId === 'string') {
    roleId = rawRoleId;
  } else if (typeof rawRoleId === 'number') {
    roleId = String(rawRoleId);
  } else {
    return null;
  }
  // The display name is deliberately lenient, unlike `roleId` above: it is
  // never used for authorization, so a malformed name must never drop an
  // otherwise valid membership (and with it, a business the caller can read).
  // Anything that is not a string is simply treated as "no name".
  const rawBusinessName = record.businessName ?? record.business_name;
  const businessName = typeof rawBusinessName === 'string' ? rawBusinessName : undefined;
  return { memberBusinessId: businessId, roleId, businessName };
}

/** De-duplicate memberships by business id (first occurrence wins). */
export function dedupeMemberships(
  memberships: readonly BusinessMembership[],
): BusinessMembership[] {
  const seen = new Set<string>();
  const result: BusinessMembership[] = [];
  for (const membership of memberships) {
    if (!seen.has(membership.memberBusinessId)) {
      seen.add(membership.memberBusinessId);
      result.push(membership);
    }
  }
  return result;
}

/** Default membership source: read the `memberships` custom claim off the token. */
export const membershipsFromClaims: MembershipSource = principal => {
  const raw = principal.claims[MEMBERSHIPS_CLAIM];
  if (!Array.isArray(raw)) {
    return [];
  }
  const memberships: BusinessMembership[] = [];
  for (const entry of raw) {
    const membership = coerceMembership(entry);
    if (membership) {
      memberships.push(membership);
    }
  }
  return dedupeMemberships(memberships);
};

/**
 * Assemble an {@link McpAuthContext} from a verified principal and its resolved
 * memberships. Throws {@link IdentityMappingError} when the principal has no
 * subject (cannot identify a user). An empty membership set is a valid user
 * with no business access — authorization (later step) decides what that user
 * may do.
 */
export function buildAuthContext(
  principal: AuthPrincipal,
  memberships: readonly BusinessMembership[],
): McpAuthContext {
  if (!principal.subject) {
    throw new IdentityMappingError('verified token has no subject claim');
  }
  const deduped = dedupeMemberships(memberships);
  return {
    userId: principal.subject,
    auth0UserId: principal.subject,
    email: principal.email,
    roles: principal.scopes,
    memberships: deduped,
    defaultReadScope: readScopeFromMemberships(deduped),
    principal,
  };
}

/**
 * Resolve the full auth context for a verified principal using the given
 * membership source (defaults to reading the token's `memberships` claim).
 */
export async function resolveAuthContext(
  principal: AuthPrincipal,
  source: MembershipSource = membershipsFromClaims,
): Promise<McpAuthContext> {
  const memberships = await source(principal);
  return buildAuthContext(principal, memberships);
}

// Associate a resolved auth context with its request for downstream steps.
const contextByRequest = new WeakMap<IncomingMessage, McpAuthContext>();

export function setAuthContext(req: IncomingMessage, context: McpAuthContext): void {
  contextByRequest.set(req, context);
}

export function getAuthContext(req: IncomingMessage): McpAuthContext | undefined {
  return contextByRequest.get(req);
}
