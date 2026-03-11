import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeysProvider } from '../providers/api-keys.provider.js';
import { apiKeysResolvers } from '../resolvers/api-keys.resolver.js';

const listApiKeysResolver = apiKeysResolvers.Query?.listApiKeys as (
  source: unknown,
  args: Record<string, never>,
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<unknown>;

const revokeApiKeyResolver = apiKeysResolvers.Mutation?.revokeApiKey as (
  source: unknown,
  args: { id: string },
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<boolean>;

const mockInfo = {} as GraphQLResolveInfo;

describe('API key management', () => {
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockDb: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let mockAuditProvider: { log: ReturnType<typeof vi.fn> };
  let apiKeysProvider: ApiKeysProvider;

  beforeEach(() => {
    mockAuthProvider = {
      getAuthContext: vi.fn().mockResolvedValue({
        authType: 'jwt',
        token: 'owner-token',
        user: {
          userId: 'owner-user-id',
          roleId: 'business_owner',
          email: 'owner@example.com',
          auth0UserId: 'auth0|owner-user-id',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 1,
        },
        tenant: {
          businessId: 'business-123',
          roleId: 'business_owner',
        },
      }),
    };

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async callback => {
        return callback(mockDb);
       }),
     };

    mockAuditProvider = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    apiKeysProvider = new ApiKeysProvider(
      mockDb as never,
      mockAuthProvider as never,
      mockAuditProvider as never,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createContext() {
    return {
      injector: {
        get<T>(token: unknown): T {
          if (token === ApiKeysProvider) {
            return apiKeysProvider as T;
          }
          throw new Error(`Unexpected token requested: ${String(token)}`);
        },
      },
    };
  }

  it('listApiKeys returns active keys sorted by creation time', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'key-2',
          name: 'newer key',
          role_id: 'scraper',
          last_used_at: new Date('2030-02-01T00:00:00.000Z'),
          created_at: new Date('2030-02-01T00:00:00.000Z'),
        },
        {
          id: 'key-1',
          name: 'older key',
          role_id: 'employee',
          last_used_at: null,
          created_at: new Date('2030-01-01T00:00:00.000Z'),
        },
      ],
      rowCount: 2,
    });

    const result = await listApiKeysResolver({}, {}, createContext(), mockInfo);

    expect(result).toEqual([
      {
        id: 'key-2',
        name: 'newer key',
        roleId: 'scraper',
        lastUsedAt: new Date('2030-02-01T00:00:00.000Z'),
        createdAt: new Date('2030-02-01T00:00:00.000Z'),
      },
      {
        id: 'key-1',
        name: 'older key',
        roleId: 'employee',
        lastUsedAt: null,
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
      },
    ]);
  });

  it('revokeApiKey soft-deletes and writes API_KEY_REVOKED audit log', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 'key-1' }],
      rowCount: 1,
    });

    const revoked = await revokeApiKeyResolver({}, { id: 'key-1' }, createContext(), mockInfo);

    expect(revoked).toBe(true);

    expect(mockAuditProvider.log).toHaveBeenCalledTimes(1);
    const auditEvent = mockAuditProvider.log.mock.calls[0][0];
    expect(JSON.stringify(auditEvent)).not.toContain({
        action: 'API_KEY_REVOKED',
        entity: 'ApiKey',
        entityId: 'key-1',
        ownerId: 'business-123',
        userId: 'owner-user-id',
      });
  });

  it('revokeApiKey returns false when key does not exist or already revoked', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const revoked = await revokeApiKeyResolver({}, { id: 'missing-key' }, createContext(), mockInfo);

    expect(revoked).toBe(false);
    expect(mockAuditProvider.log).not.toHaveBeenCalled();
  });

  it('listApiKeys wraps unexpected failures', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('db down'));

    await expect(listApiKeysResolver({}, {}, createContext(), mockInfo)).rejects.toSatisfy(error => {
      return error instanceof GraphQLError && error.extensions?.code === 'API_KEY_LIST_FAILED';
    });
  });

  it('revokeApiKey wraps unexpected failures', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('db down'));

    await expect(
      revokeApiKeyResolver({}, { id: 'key-1' }, createContext(), mockInfo),
    ).rejects.toSatisfy(error => {
      return (
        error instanceof GraphQLError && error.extensions?.code === 'API_KEY_REVOCATION_FAILED'
      );
    });
  });
});
