import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeysResolvers } from '../resolvers/api-keys.resolver.js';
import { ApiKeysProvider, type ApiKeyRecord } from '../providers/api-keys.provider.js';

const generateApiKeyResolver = apiKeysResolvers.Mutation?.generateApiKey as (
  source: unknown,
  args: { name: string; roleId: string },
  context: { injector: { get<T>(token: unknown): T } },
  info: GraphQLResolveInfo,
) => Promise<{
  apiKey: string;
  record: ApiKeyRecord;
}>;

const mockInfo = {} as GraphQLResolveInfo;

describe('generateApiKey mutation', () => {
  let mockAuthProvider: { getAuthContext: ReturnType<typeof vi.fn> };
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockAuditProvider: { log: ReturnType<typeof vi.fn> };
  let apiKeysProvider: ApiKeysProvider;

  beforeEach(() => {
    mockAuthProvider = {
      getAuthContext: vi.fn().mockResolvedValue({
        authType: 'jwt',
        token: 'token',
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
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 'api-key-id-1',
            name: 'nightly scraper key',
            role_id: 'scraper',
            last_used_at: null,
            created_at: new Date('2030-01-01T00:00:00.000Z'),
          },
        ],
      }),
      transaction: vi.fn().mockImplementation(async callback => callback(mockDb)),
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

  it('business_owner can generate API key', async () => {
    const result = await generateApiKeyResolver(
      {},
      { name: 'nightly scraper key', roleId: 'scraper' },
      createContext(),
      mockInfo,
    );

    expect(result.record).toEqual({
      id: 'api-key-id-1',
      name: 'nightly scraper key',
      roleId: 'scraper',
      lastUsedAt: null,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    expect(result.apiKey).toMatch(/^[a-f0-9]{128}$/);
  });

  it('plaintext key is 128 hex characters', async () => {
    const result = await generateApiKeyResolver(
      {},
      { name: 'automation key', roleId: 'scraper' },
      createContext(),
      mockInfo,
    );

    expect(result.apiKey).toHaveLength(128);
    expect(result.apiKey).toMatch(/^[a-f0-9]{128}$/);
  });

  it('stores SHA-256 hash in database (not plaintext)', async () => {
    const result = await generateApiKeyResolver(
      {},
      { name: 'finance sync key', roleId: 'scraper' },
      createContext(),
      mockInfo,
    );

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [, params] = mockDb.query.mock.calls[0];
    const storedHash = params[2] as string;

    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).not.toBe(result.apiKey);
    expect(params).not.toContain(result.apiKey);
  });

  it('rejects invalid roleIds for API keys', async () => {
    const INVALID_ROLES = ['business_owner', 'employee', 'accountant'];
    for (const roleId of INVALID_ROLES) {
      await expect(
        generateApiKeyResolver(
          {},
          { name: 'forbidden key', roleId },
          createContext(),
          mockInfo,
        ),
      ).rejects.toSatisfy(error => {
        return error instanceof GraphQLError && error.extensions?.code === 'INVALID_ARGUMENT';
      });
  
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockAuditProvider.log).not.toHaveBeenCalled();
    }
  });

  it('API key returned only in response (not stored in plaintext)', async () => {
    const result = await generateApiKeyResolver(
      {},
      { name: 'audit-safe key', roleId: 'scraper' },
      createContext(),
      mockInfo,
    );

    expect(mockAuditProvider.log).toHaveBeenCalledTimes(1);
    const auditEvent = mockAuditProvider.log.mock.calls[0][0];

    expect(JSON.stringify(auditEvent)).not.toContain(result.apiKey);
  });

  it('creates API_KEY_CREATED audit log entry', async () => {
    await generateApiKeyResolver(
      {},
      { name: 'logging key', roleId: 'scraper' },
      createContext(),
      mockInfo,
    );

    expect(mockAuditProvider.log).toHaveBeenCalledTimes(1);
    expect(mockAuditProvider.log.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        action: 'API_KEY_CREATED',
        entity: 'ApiKey',
        entityId: 'api-key-id-1',
        ownerId: 'business-123',
        userId: 'owner-user-id',
        auth0UserId: 'auth0|owner-user-id',
      }),
    );
  });
});
