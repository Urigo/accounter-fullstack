import type { UserInfo } from '../../providers/index.js';

/** The only role `runCronJobs` accepts (`@requiresRole(role: "business_owner")`). */
export const MANUAL_AUTOMATIONS_ROLE = 'business_owner';

/**
 * Whether the server would let this user run the manual automations.
 *
 * `runCronJobs` checks the caller's role in the request's write-target business: the only business
 * in a single-business scope, otherwise the user's primary business if in scope. The client can't
 * tell which business is primary, so it requires the owner role in every business of the active
 * scope. That is exact for a single-business scope, and never offers a run the server refuses.
 */
export function canRunManualAutomations(context: UserInfo['context'] | null | undefined): boolean {
  if (!context) {
    return false;
  }
  const scope =
    context.activeReadScope.length > 0
      ? context.activeReadScope
      : context.memberships.map(membership => membership.businessId);
  if (scope.length === 0) {
    return false;
  }
  return scope.every(
    businessId =>
      context.memberships.find(membership => membership.businessId === businessId)?.role ===
      MANUAL_AUTOMATIONS_ROLE,
  );
}
