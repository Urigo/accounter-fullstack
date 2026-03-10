import { createHash, randomBytes } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type { AuthContext, TenantContext } from '../../../shared/types/auth.js';
import type { NoOptionalField } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import { ALLOWED_API_KEY_ROLES } from '../helpers/api-keys.helper.js';
import type { IInsertApiKeyQuery, IListApiKeysQuery, IRevokeApiKeyQuery } from '../types.js';
import { AuthContextProvider } from './auth-context.provider.js';

// Define a more specific type for the context after validation
type ValidatedAuthContext = NoOptionalField<AuthContext, 'user'> & {
  tenant: NoOptionalField<TenantContext, 'businessId'>;
};

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

const listApiKeys = sql<IListApiKeysQuery>`
  SELECT id, name, role_id, last_used_at, created_at
  FROM accounter_schema.api_keys
  WHERE business_id = $ownerId
    AND revoked_at IS NULL
  ORDER BY created_at DESC;
`;

const revokeApiKey = sql<IRevokeApiKeyQuery>`
  UPDATE accounter_schema.api_keys
  SET revoked_at = NOW()
  WHERE id = $id
    AND business_id = $ownerId
    AND revoked_at IS NULL
  RETURNING id;
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
    const authContext = await this.requireBusinessOwner();
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
          userId: authContext.user.userId,
          auth0UserId: authContext.user.auth0UserId ?? undefined,
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

  public async listApiKeys(): Promise<ApiKeyRecord[]> {
    const authContext = await this.requireBusinessOwner();

    const rows = await listApiKeys.run({ ownerId: authContext.tenant.businessId }, this.db);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      roleId: row.role_id,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    }));
  }

  public async revokeApiKey(id: string): Promise<boolean> {
    const authContext = await this.requireBusinessOwner();

    const rows = await revokeApiKey.run({ id, ownerId: authContext.tenant.businessId }, this.db);
    const revoked = rows.length > 0;

    if (!revoked) {
      return false;
    }

    await this.auditLogsProvider.insertAuditLog({
      ownerId: authContext.tenant.businessId,
      userId: authContext.user.userId,
      auth0UserId: authContext.user.auth0UserId ?? undefined,
      action: 'API_KEY_REVOKED',
      entity: 'ApiKey',
      entityId: id,
      details: {
        revoked: true,
      },
    });

    return true;
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
