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
