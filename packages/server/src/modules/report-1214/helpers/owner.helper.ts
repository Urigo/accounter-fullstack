import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { resolveWriteTargetBusinessId } from '../../../shared/helpers/auth-scope.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';

/**
 * The roles that may read or change a business's form 1214 data. The typeDefs' `@requiresAnyRole`
 * directives repeat this list as a literal (a directive argument cannot reference a constant) and
 * must be kept in sync with it.
 */
export const REPORT_1214_ROLES = ['business_owner', 'accountant'] as const;

const REPORT_1214_ROLE_SET: ReadonlySet<string> = new Set(REPORT_1214_ROLES);

/**
 * The request's active business: the one row-level security binds every write to. Derived exactly
 * as `TenantAwareDBClient` derives `app.current_business_id`, so the two cannot drift.
 */
async function requireAuthContext(injector: Injector): Promise<AuthContext> {
  const authContext = await injector.get(AuthContextProvider).getAuthContext();
  if (!authContext) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return authContext;
}

async function getActiveWriteTarget(injector: Injector): Promise<string> {
  const authContext = await requireAuthContext(injector);
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
 * Whether `ownerId` is the request's active business (the session's write target). Reads that
 * depend on session-wide settings (e.g. the tax computation, which reads the session's admin
 * context) are only consistent for that owner.
 */
export async function isActiveReport1214Owner(
  injector: Injector,
  ownerId: string,
): Promise<boolean> {
  return (await getActiveWriteTarget(injector)).toLowerCase() === ownerId.toLowerCase();
}

/**
 * Throws `FORBIDDEN` unless the caller's membership in `ownerId` carries one of
 * {@link REPORT_1214_ROLES}. The `@requiresAnyRole` directive only checks the role in the active
 * business, while an explicit `ownerId` may name another business in the caller's scope.
 */
async function assertReport1214Role(injector: Injector, ownerId: string): Promise<void> {
  const authContext = await requireAuthContext(injector);
  const membership = (authContext.memberships ?? []).find(
    member => member.businessId.toLowerCase() === ownerId,
  );
  if (!membership || !REPORT_1214_ROLE_SET.has(membership.roleId)) {
    throw new GraphQLError(
      `Your role in business ${ownerId} does not allow access to its 1214 data`,
      {
        extensions: { code: 'FORBIDDEN' },
      },
    );
  }
}

/**
 * Resolves the owner (company) a form 1214 read or write applies to. The result is lowercased:
 * the UUID scalar keeps the caller's case, while Postgres returns UUIDs in lowercase.
 *
 * - An explicit `ownerId` is checked against the caller's access, as other per-business modules
 *   do: reads must be within the read scope (`ScopeProvider.getReadScope`), writes must target a
 *   business the caller is a member of (`ScopeProvider.resolveWriteTarget`). Both throw `FORBIDDEN`
 *   otherwise.
 * - For an explicit `ownerId`, reads and writes alike, the caller's membership in that business
 *   must also carry one of {@link REPORT_1214_ROLES}: the `@requiresAnyRole` directive only checks
 *   the role in the active business. Otherwise `FORBIDDEN`.
 * - A write must also target the request's active business. Row-level security binds every write
 *   to it (`app.current_business_id`), so a write to another business the caller belongs to would
 *   otherwise delete nothing and still look like it succeeded.
 * - Without an `ownerId`, the request's active business is used; the directive already checked the
 *   caller's role there.
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
    await assertReport1214Role(injector, ownerId);
    return ownerId;
  }

  await scopeProvider.resolveWriteTarget(ownerId);
  await assertReport1214Role(injector, ownerId);
  const activeOwnerId = (await getActiveWriteTarget(injector)).toLowerCase();
  if (activeOwnerId !== ownerId) {
    throw new GraphQLError(
      `Switch the active business to ${ownerId} to edit its 1214 data (the active business is ${activeOwnerId})`,
      { extensions: { code: 'FORBIDDEN' } },
    );
  }
  return ownerId;
}
