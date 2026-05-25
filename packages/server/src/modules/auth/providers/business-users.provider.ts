import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { BusinessMembership } from '../../../shared/types/auth.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetBusinessUsersByAuth0IdsQuery,
  IInsertBusinessUserParams,
  IInsertBusinessUserQuery,
} from '../types.js';

const getBusinessUsersByAuth0Ids = sql<IGetBusinessUsersByAuth0IdsQuery>`
  SELECT user_id, auth0_user_id, business_id, role_id
  FROM accounter_schema.business_users
  WHERE auth0_user_id IN $$auth0UserIds;
`;

const insertBusinessUser = sql<IInsertBusinessUserQuery>`
  INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
    VALUES ($userId, $auth0UserId, $ownerId, $roleId)
    ON CONFLICT (user_id, business_id) DO NOTHING
    RETURNING *;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessUsersProvider {
  constructor(private db: TenantAwareDBClient) {}

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
}
