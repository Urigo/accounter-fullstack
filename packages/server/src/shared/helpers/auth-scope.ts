import type { AuthorizedReadScope, BusinessMembership, TenantContext } from '../types/auth.js';

/**
 * Adapter helpers bridging the legacy single-business `TenantContext` and the
 * multi-business membership / read-scope types. These let existing code keep
 * compiling while the migration introduces membership-aware auth, before any
 * provider/resolver is switched over.
 */

/** Build a membership from the legacy single-business tenant context. */
export function membershipFromTenant(tenant: TenantContext): BusinessMembership {
  return {
    businessId: tenant.businessId,
    roleId: tenant.roleId ?? '',
    ...(tenant.businessName ? { businessName: tenant.businessName } : {}),
  };
}

/** Collapse a membership back into the legacy single-business tenant context. */
export function tenantFromMembership(membership: BusinessMembership): TenantContext {
  return {
    businessId: membership.businessId,
    roleId: membership.roleId,
    ...(membership.businessName ? { businessName: membership.businessName } : {}),
  };
}

/**
 * Default read scope = every business the user belongs to, de-duplicated and
 * order-preserving.
 */
export function readScopeFromMemberships(
  memberships: BusinessMembership[] | undefined | null,
): AuthorizedReadScope {
  const businessIds = memberships ? [...new Set(memberships.map(m => m.businessId))] : [];
  return { businessIds };
}

/** Whether a business id is part of an authorized read scope. */
export function isBusinessInScope(
  scope: AuthorizedReadScope | undefined | null,
  businessId: string,
): boolean {
  return scope?.businessIds.includes(businessId) ?? false;
}

/**
 * Resolve the effective read scope for a request by applying the precedence
 * rule: GraphQL args narrow the header scope, which narrows the user's
 * memberships. Formally `args ⊆ header ⊆ memberships`.
 *
 * - When neither header nor args narrowing is requested, defaults to all
 *   accessible businesses.
 * - The header scope must be a subset of the memberships; the args scope must
 *   be a subset of the (already header-narrowed) scope.
 * - Returns `null` to signal rejection when any requested id falls outside the
 *   scope it is narrowing — callers must reject rather than silently drop ids.
 *
 * This is the single, reusable precedence check; resolvers and the scope
 * provider should use it rather than re-implementing narrowing per module.
 */
export function resolveReadScopePrecedence(params: {
  memberships: BusinessMembership[];
  headerBusinessIds?: string[];
  argsBusinessIds?: string[];
}): AuthorizedReadScope | null {
  const { memberships, headerBusinessIds, argsBusinessIds } = params;

  let scope = readScopeFromMemberships(memberships);

  if (headerBusinessIds && headerBusinessIds.length > 0) {
    const narrowed = narrowReadScope(memberships, headerBusinessIds);
    if (!narrowed) {
      return null;
    }
    scope = narrowed;
  }

  if (argsBusinessIds && argsBusinessIds.length > 0) {
    const allowed: BusinessMembership[] = scope.businessIds.map(businessId => ({
      businessId,
      roleId: '',
    }));
    const narrowed = narrowReadScope(allowed, argsBusinessIds);
    if (!narrowed) {
      return null;
    }
    scope = narrowed;
  }

  return scope;
}

/**
 * Narrow a user's memberships to a requested set of business ids.
 *
 * Returns the requested ids (de-duplicated, request order preserved) as the
 * read scope, or `null` if ANY requested id is outside the user's memberships —
 * callers must reject such requests rather than silently dropping unknown ids.
 */
export function narrowReadScope(
  memberships: BusinessMembership[],
  requestedBusinessIds: string[],
): AuthorizedReadScope | null {
  const allowed = new Set(memberships.map(membership => membership.businessId));
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
