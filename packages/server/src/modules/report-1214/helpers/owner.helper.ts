import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';

/**
 * Resolves the owner (company) a form 1214 read or write applies to. The result is lowercased:
 * the UUID scalar keeps the caller's case, while Postgres returns UUIDs in lowercase.
 *
 * - An explicit `ownerId` is checked against the caller's access, as other per-business modules
 *   do: reads must be within the read scope (`ScopeProvider.getReadScope`), writes must target a
 *   business the caller is a member of (`ScopeProvider.resolveWriteTarget`). Both throw `FORBIDDEN`
 *   otherwise.
 * - A write must also target the request's active business. Row-level security binds every write
 *   to it (`app.current_business_id`, the admin context's owner), so a write to another business
 *   the caller belongs to would otherwise delete nothing and still look like it succeeded.
 * - Without an `ownerId`, the request's active business (`AdminContextProvider`) is used.
 */
export async function resolveReport1214Owner(
  injector: Injector,
  requestedOwnerId: string | null | undefined,
  access: 'read' | 'write',
): Promise<string> {
  const ownerId = requestedOwnerId?.toLowerCase();
  if (!ownerId) {
    const adminContext = await injector.get(AdminContextProvider).getVerifiedAdminContext();
    return adminContext.ownerId;
  }

  const scopeProvider = injector.get(ScopeProvider);
  if (access === 'read') {
    await scopeProvider.getReadScope([ownerId]);
    return ownerId;
  }

  await scopeProvider.resolveWriteTarget(ownerId);
  const { ownerId: activeOwnerId } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();
  if (activeOwnerId !== ownerId) {
    throw new GraphQLError(
      `Switch the active business to ${ownerId} to edit its 1214 data (the active business is ${activeOwnerId})`,
      { extensions: { code: 'FORBIDDEN' } },
    );
  }
  return ownerId;
}
