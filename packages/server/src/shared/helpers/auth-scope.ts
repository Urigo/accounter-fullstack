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
