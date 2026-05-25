import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { narrowReadScope, readScopeFromMemberships } from '../../../shared/helpers/auth-scope.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { AdminContext } from '../../admin-context/types.js';
import { AuthContextProvider } from './auth-context.provider.js';

/**
 * Single, reusable entry point for request-level business scope decisions.
 *
 * Resolvers and providers should use this rather than re-implementing scope
 * narrowing or reaching into the admin context per module:
 * - reads default to all accessible businesses, narrowed by request args;
 * - writes require an explicit, membership-validated single target;
 * - per-business preferences are resolved within the authorized read scope.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ScopeProvider {
  constructor(
    private authContextProvider: AuthContextProvider,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async requireAuthContext(): Promise<AuthContext> {
    const authContext = await this.authContextProvider.getAuthContext();
    if (!authContext) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return authContext;
  }

  /**
   * The effective read scope: the request's authorized scope
   * (header ∩ memberships, resolved by the auth context) narrowed by the
   * optionally-provided args business ids. Defaults to all accessible
   * businesses. Throws when args request a business outside the authorized
   * scope (callers must reject, never broaden).
   */
  public async getReadScope(argsBusinessIds?: string[]): Promise<string[]> {
    const authContext = await this.requireAuthContext();
    const baseScope =
      authContext.activeReadScope ?? readScopeFromMemberships(authContext.memberships ?? []);

    if (!argsBusinessIds || argsBusinessIds.length === 0) {
      return baseScope.businessIds;
    }

    const allowed = baseScope.businessIds.map(businessId => ({ businessId, roleId: '' }));
    const narrowed = narrowReadScope(allowed, argsBusinessIds);
    if (!narrowed) {
      throw new GraphQLError('Requested business scope is outside the authorized read scope', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    return narrowed.businessIds;
  }

  /**
   * Validate and return the single write-target business. Writes always take an
   * explicit business id (never inferred from the read scope); the target must
   * be one of the user's memberships.
   */
  public async resolveWriteTarget(requestedBusinessId: string | null | undefined): Promise<string> {
    const authContext = await this.requireAuthContext();

    if (!requestedBusinessId) {
      throw new GraphQLError('An explicit target businessId is required for writes', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const isMember = (authContext.memberships ?? []).some(
      membership => membership.businessId === requestedBusinessId,
    );
    if (!isMember) {
      throw new GraphQLError('Not authorized to write to the requested business', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return requestedBusinessId;
  }

  /**
   * Resolve a single business preference (e.g. `defaultLocalCurrency`) for a
   * specific business within the authorized read scope. Replaces per-field
   * reads of the request's single admin context, so multi-business reads can
   * resolve preferences from each row's owning business.
   */
  public async getBusinessPreference<K extends keyof AdminContext>(
    businessId: string,
    key: K,
  ): Promise<AdminContext[K] | null> {
    const scope = await this.getReadScope();
    if (!scope.includes(businessId)) {
      throw new GraphQLError('Business is outside the authorized read scope', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const adminContext =
      await this.adminContextProvider.adminContextByOwnerIdLoader.load(businessId);
    return adminContext ? adminContext[key] : null;
  }
}
