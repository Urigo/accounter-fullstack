import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IGetSuperAdminByAuth0IdQuery } from '../types.js';
import { AuthContextProvider } from './auth-context.provider.js';

const getSuperAdminByAuth0Id = sql<IGetSuperAdminByAuth0IdQuery>`
  SELECT auth0_user_id
  FROM accounter_schema.super_admins
  WHERE auth0_user_id = $auth0UserId
  LIMIT 1;
`;

@Injectable({ scope: Scope.Operation, global: true })
export class SuperAdminProvider {
  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
  ) {}

  async isSuperAdmin(auth0UserId: string): Promise<boolean> {
    const rows = await getSuperAdminByAuth0Id.run({ auth0UserId }, this.db);
    return rows.length > 0;
  }

  async requireSuperAdmin(): Promise<{ userId: string; auth0UserId: string }> {
    const auth = await this.authContextProvider.getAuthContext();
    const auth0UserId = auth?.user?.auth0UserId;
    const userId = auth?.user?.userId;

    if (!auth0UserId || !userId) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const ok = await this.isSuperAdmin(auth0UserId);
    if (!ok) {
      throw new GraphQLError('Super-admin access required', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return { userId, auth0UserId };
  }
}
