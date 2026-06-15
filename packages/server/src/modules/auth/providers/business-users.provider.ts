import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { AuthContext, BusinessMembership, TenantContext } from '../../../shared/types/auth.js';
import type { NoOptionalField } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import type {
  IDeleteBusinessUserQuery,
  IGetBusinessUsersByAuth0IdsQuery,
  IInsertBusinessUserParams,
  IInsertBusinessUserQuery,
  IListBusinessUsersQuery,
} from '../types.js';
import { AuthContextProvider } from './auth-context.provider.js';
import { Auth0ManagementProvider } from './auth0-management.provider.js';

// Validated auth context: business owner with a resolved tenant business id.
type ValidatedAuthContext = NoOptionalField<AuthContext, 'user'> & {
  tenant: NoOptionalField<TenantContext, 'businessId'>;
};

/** A user linked to a business, enriched with their Auth0 identity. */
export type BusinessUserRecord = {
  id: string;
  email: string;
  name: string | null;
  roleId: string;
  createdAt: Date;
};

const getBusinessUsersByAuth0Ids = sql<IGetBusinessUsersByAuth0IdsQuery>`
  SELECT user_id, auth0_user_id, business_id, role_id
  FROM accounter_schema.business_users
  WHERE auth0_user_id IN $$auth0UserIds
  ORDER BY updated_at DESC;
`;

const insertBusinessUser = sql<IInsertBusinessUserQuery>`
  INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
    VALUES ($userId, $auth0UserId, $ownerId, $roleId)
    ON CONFLICT (user_id, business_id) DO NOTHING
    RETURNING *;
`;

// Strictly tenant-scoped: only rows for the current business are returned.
// `business_users` does not store email/name (identity lives in Auth0); the
// linked invitation email is selected as a fallback for users that have not
// yet completed Auth0 login.
const listBusinessUsers = sql<IListBusinessUsersQuery>`
  SELECT
    bu.user_id,
    bu.auth0_user_id,
    bu.role_id,
    bu.created_at,
    (
      SELECT i.email
      FROM accounter_schema.invitations i
      WHERE i.user_id = bu.user_id
        AND i.business_id = bu.business_id
      ORDER BY i.created_at DESC
      LIMIT 1
    ) AS fallback_email
  FROM accounter_schema.business_users bu
  WHERE bu.business_id = $ownerId
  ORDER BY bu.created_at DESC;
`;

// Strictly tenant-scoped: the business id guard prevents removing a membership
// that belongs to another tenant even if a valid user id is supplied.
const deleteBusinessUser = sql<IDeleteBusinessUserQuery>`
  DELETE FROM accounter_schema.business_users
  WHERE user_id = $userId
    AND business_id = $ownerId
  RETURNING user_id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessUsersProvider {
  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
    private auth0ManagementProvider: Auth0ManagementProvider,
    private auditLogsProvider: AuditLogsProvider,
  ) {}

  private async batchBusinessUsersByAuth0Ids(auth0UserIds: readonly string[]) {
    const businessUsers = await getBusinessUsersByAuth0Ids.run(
      {
        auth0UserIds: auth0UserIds ? [...auth0UserIds] : [],
      },
      this.db,
    );
    return auth0UserIds.map(auth0UserId =>
      businessUsers.filter(t => t.auth0_user_id === auth0UserId),
    );
  }

  public getBusinessUsersByAuth0IdsLoader = new DataLoader((auth0UserIds: readonly string[]) =>
    this.batchBusinessUsersByAuth0Ids(auth0UserIds),
  );

  /**
   * Resolve every business membership for an authenticated Auth0 user.
   * Reuses the batching loader; returns an empty array when the user has no
   * memberships.
   */
  public async getMembershipsByAuth0UserId(auth0UserId: string): Promise<BusinessMembership[]> {
    const rows = await this.getBusinessUsersByAuth0IdsLoader.load(auth0UserId);
    return rows.map(row => ({
      businessId: row.business_id,
      roleId: row.role_id,
    }));
  }

  public async insertBusinessUser(params: IInsertBusinessUserParams) {
    return insertBusinessUser.run(params, this.db);
  }

  /**
   * List all users linked to the current business.
   * Restricted to business owners and strictly scoped to the caller's tenant.
   * Email/name are enriched from Auth0 (the identity system of record), with the
   * linked invitation email used as a fallback when an Auth0 lookup is unavailable.
   */
  public async listBusinessUsers(): Promise<BusinessUserRecord[]> {
    const authContext = await this.requireBusinessOwner();

    const rows = await listBusinessUsers.run({ ownerId: authContext.tenant.businessId }, this.db);

    return Promise.all(
      rows.map(async row => {
        let email = row.fallback_email ?? null;
        let name: string | null = null;

        if (row.auth0_user_id) {
          const profile = await this.auth0ManagementProvider.getUserProfileById(row.auth0_user_id);
          if (profile) {
            email = profile.email ?? email;
            name = profile.name ?? null;
          }
        }

        return {
          id: row.user_id,
          email: email ?? '',
          name,
          roleId: row.role_id,
          createdAt: row.created_at,
        };
      }),
    );
  }

  /**
   * Remove a user's membership from the current business.
   * Restricted to business owners and strictly scoped to the caller's tenant, so
   * a membership belonging to another business can never be removed. Deleting the
   * relation does not touch the user's global Auth0 identity.
   * Returns false when no matching membership exists in the current business.
   */
  public async removeBusinessUser(userId: string): Promise<boolean> {
    const authContext = await this.requireBusinessOwner();

    return this.db.transaction(async client => {
      const rows = await deleteBusinessUser.run(
        { userId, ownerId: authContext.tenant.businessId },
        client,
      );
      const removed = rows.length > 0;
      if (!removed) {
        return false;
      }

      await this.auditLogsProvider.log(
        {
          ownerId: authContext.tenant.businessId,
          userId: authContext.user.userId,
          auth0UserId: authContext.user.auth0UserId ?? undefined,
          action: 'BUSINESS_USER_REMOVED',
          entity: 'BusinessUser',
          entityId: userId,
          details: {
            removed: true,
          },
        },
        client,
      );
      return true;
    });
  }

  private async requireBusinessOwner(): Promise<ValidatedAuthContext> {
    const authContext = await this.authContextProvider.getAuthContext();

    if (!authContext) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { user, tenant, ...restOfAuthContext } = authContext;

    if (!tenant?.businessId) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (user.roleId !== 'business_owner') {
      throw new GraphQLError('Requires role: business_owner', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return { ...restOfAuthContext, user, tenant };
  }
}
