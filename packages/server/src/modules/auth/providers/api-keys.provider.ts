import { createHash, randomBytes } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import type { IInsertApiKeyQuery } from '../types.js';
import { AuthContextProvider } from './auth-context.provider.js';

const ALLOWED_API_KEY_ROLES = ['scraper', 'accountant', 'employee'] as const;

export type ApiKeyRecord = {
  id: string;
  name: string;
  roleId: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

const insertApiKey = sql<IInsertApiKeyQuery>`
  INSERT INTO accounter_schema.api_keys (business_id, role_id, key_hash, name)
  VALUES ($ownerId, $roleId, $keyHash, $name)
  RETURNING id, name, role_id, last_used_at, created_at;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ApiKeysProvider {
  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
    private auditLogsProvider: AuditLogsProvider,
  ) {}

  public async generateApiKey(name: string, roleId: string) {
    const authContext = await this.authContextProvider.getAuthContext();

    if (!authContext?.user || !authContext.tenant?.businessId) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (authContext.user.roleId !== 'business_owner') {
      throw new GraphQLError('Requires role: business_owner', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    if (!ALLOWED_API_KEY_ROLES.includes(roleId as (typeof ALLOWED_API_KEY_ROLES)[number])) {
      throw new GraphQLError(
        `Invalid role for API key. Must be one of: ${ALLOWED_API_KEY_ROLES.join(', ')}`,
        {
          extensions: { code: 'INVALID_ARGUMENT' },
        },
      );
    }

    const plaintextKey = randomBytes(64).toString('hex');
    const keyHash = createHash('sha256').update(plaintextKey).digest('hex');

    return this.db.transaction(async client => {
      const result = await insertApiKey.run(
        {
          ownerId: authContext.tenant.businessId,
          roleId,
          keyHash,
          name,
        },
        client,
      );

      const [row] = result;
      if (!row) {
        throw new GraphQLError('API key creation failed: no record returned from DB.', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const record: ApiKeyRecord = {
        id: row.id,
        name: row.name,
        roleId: row.role_id,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
      };

      await this.auditLogsProvider.log(
        {
          ownerId: authContext.tenant.businessId,
          userId: authContext.user!.userId,
          auth0UserId: authContext.user!.auth0UserId ?? undefined,
          action: 'API_KEY_CREATED',
          entity: 'ApiKey',
          entityId: record.id,
          details: {
            name: record.name,
            roleId: record.roleId,
          },
        },
        client,
      );

      return {
        apiKey: plaintextKey,
        record,
      };
    });
  }
}
