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
  businessId: string;
  roleId: string;
}

/** The set of businesses a request is authorized to read from. */
export interface AuthorizedReadScope {
  businessIds: string[];
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
  return { businessIds: [...new Set(memberships.map(m => m.businessId))] };
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
  requestedBusinessIds: readonly string[],
): AuthorizedReadScope | null {
  const allowed = new Set(memberships.map(m => m.businessId));
  const seen = new Set<string>();
  const businessIds: string[] = [];
  for (const businessId of requestedBusinessIds) {
    if (!allowed.has(businessId)) {
      return null;
    }
    if (!seen.has(businessId)) {
      seen.add(businessId);
      businessIds.push(businessId);
    }
  }
  return { businessIds };
}

/**
 * Resolve the effective read scope for a request: no requested ids ⇒ the
 * default (all memberships); otherwise the requested subset, or `null` when any
 * requested id falls outside the user's memberships.
 */
export function resolveRequestedReadScope(
  context: McpAuthContext,
  requestedBusinessIds?: readonly string[],
): AuthorizedReadScope | null {
  if (!requestedBusinessIds || requestedBusinessIds.length === 0) {
    return context.defaultReadScope;
  }
  return narrowReadScope(context.memberships, requestedBusinessIds);
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

function coerceMembership(entry: unknown): BusinessMembership | null {
  // Arrays are objects too; exclude them and any non-object claim entries.
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const businessId = record.businessId ?? record.business_id;
  if (typeof businessId !== 'string' || businessId.length === 0) {
    return null;
  }
  // Only accept a string or number role; never stringify arbitrary objects.
  const rawRoleId = record.roleId ?? record.role_id;
  const roleId =
    typeof rawRoleId === 'string'
      ? rawRoleId
      : typeof rawRoleId === 'number'
        ? String(rawRoleId)
        : '';
  return { businessId, roleId };
}

/** De-duplicate memberships by business id (first occurrence wins). */
export function dedupeMemberships(
  memberships: readonly BusinessMembership[],
): BusinessMembership[] {
  const seen = new Set<string>();
  const result: BusinessMembership[] = [];
  for (const membership of memberships) {
    if (!seen.has(membership.businessId)) {
      seen.add(membership.businessId);
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
