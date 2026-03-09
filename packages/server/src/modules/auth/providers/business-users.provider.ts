import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IInsertBusinessUserParams, IInsertBusinessUserQuery } from '../types.js';

const insertBusinessUser = sql<IInsertBusinessUserQuery>`
  INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
    VALUES ($userId, $auth0UserId, $businessId, $roleId);
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessUsersProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  public async insertBusinessUser(params: IInsertBusinessUserParams) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertBusinessUser.run({ businessId: ownerId, ...params }, this.db);
  }
}
