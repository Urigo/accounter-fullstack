import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { resolveWriteTargetBusinessId } from '../../../shared/helpers/auth-scope.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';

/**
 * The request's active business: the one row-level security binds every write to. Derived exactly
 * as `TenantAwareDBClient` derives `app.current_business_id`, so the two cannot drift.
 */
async function getActiveWriteTarget(injector: Injector): Promise<string> {
  const authContext = await injector.get(AuthContextProvider).getAuthContext();
  if (!authContext) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  const writeTarget = resolveWriteTargetBusinessId(
    authContext.tenant.businessId,
    authContext.activeReadScope,
  );
  if (!writeTarget) {
    throw new GraphQLError('No active business for the authenticated user', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return writeTarget;
}

/**
 * Resolves the owner (company) a form 1214 read or write applies to. The result is lowercased:
 * the UUID scalar keeps the caller's case, while Postgres returns UUIDs in lowercase.
 *
 * - An explicit `ownerId` is checked against the caller's access, as other per-business modules
 *   do: reads must be within the read scope (`ScopeProvider.getReadScope`), writes must target a
 *   business the caller is a member of (`ScopeProvider.resolveWriteTarget`). Both throw `FORBIDDEN`
 *   otherwise.
 * - A write must also target the request's active business. Row-level security binds every write
 *   to it (`app.current_business_id`), so a write to another business the caller belongs to would
 *   otherwise delete nothing and still look like it succeeded.
 * - Without an `ownerId`, the request's active business is used.
 */
export async function resolveReport1214Owner(
  injector: Injector,
  requestedOwnerId: string | null | undefined,
  access: 'read' | 'write',
): Promise<string> {
  const ownerId = requestedOwnerId?.toLowerCase();
  if (!ownerId) {
    return (await getActiveWriteTarget(injector)).toLowerCase();
  }

  const scopeProvider = injector.get(ScopeProvider);
  if (access === 'read') {
    await scopeProvider.getReadScope([ownerId]);
    return ownerId;
  }

  await scopeProvider.resolveWriteTarget(ownerId);
  const activeOwnerId = (await getActiveWriteTarget(injector)).toLowerCase();
  if (activeOwnerId !== ownerId) {
    throw new GraphQLError(
      `Switch the active business to ${ownerId} to edit its 1214 data (the active business is ${activeOwnerId})`,
      { extensions: { code: 'FORBIDDEN' } },
    );
  }
  return ownerId;
}
