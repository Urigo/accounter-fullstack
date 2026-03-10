import { createHash } from 'node:crypto';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { CONTEXT, Scope, createApplication, createModule, gql } from 'graphql-modules';
import { createYoga } from 'graphql-yoga';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authPlugin } from '../../../../plugins/auth-plugin.js';
import { ENVIRONMENT, RAW_AUTH } from '../../../../shared/tokens.js';
import type { Environment } from '../../../../shared/types/index.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { authDirectiveTransformer } from '../../directives/auth-directives.js';
import { AuthContextProvider } from '../auth-context.provider.js';

type ApiKeyRow = {
  id: string;
  business_id: string;
  role_id: string;
  revoked_at: Date | null;
};

describe('AuthContextProvider API key unit tests', () => {
  const mockEnv = {
    auth0: {
      domain: 'test.auth0.com',
      audience: 'test-audience',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      managementAudience: 'https://test.auth0.com/api/v2/',
    },
  } as unknown as Environment;

  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
  });

  it('valid API key returns authType=apiKey with tenant and role', async () => {
    const plaintextKey = 'valid-plain-key';
    const expectedHash = createHash('sha256').update(plaintextKey).digest('hex');

    mockDb.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'api-key-1',
            business_id: 'business-123',
            role_id: 'scraper',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'apiKey', token: plaintextKey },
      mockDb as never,
    );

    const context = await provider.getAuthContext();

    expect(context?.authType).toBe('apiKey');
    expect(context?.tenant.businessId).toBe('business-123');
    expect(context?.user?.roleId).toBe('scraper');
    expect(context?.user?.userId).toBe('api-key:api-key-1');

    expect(mockDb.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM accounter_schema.api_keys'),
      [expectedHash],
    );
  });

  it('invalid API key returns null', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'apiKey', token: 'wrong-key' },
      mockDb as never,
    );

    const context = await provider.getAuthContext();

    expect(context).toBeNull();
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('revoked API key behaves as not found and returns null', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'apiKey', token: 'revoked-key' },
      mockDb as never,
    );

    const context = await provider.getAuthContext();

    expect(context).toBeNull();
  });

  it('updates last_used_at on first use', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'api-key-2',
            business_id: 'business-xyz',
            role_id: 'scraper',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'apiKey', token: 'first-use-key' },
      mockDb as never,
    );

    await provider.getAuthContext();

    expect(mockDb.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET last_used_at = NOW()'),
      ['api-key-2'],
    );
  });

  it('API key with disallowed role (business_owner) returns null', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'api-key-bad-role',
          business_id: 'business-xyz',
          role_id: 'business_owner',
        },
      ],
    });

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'apiKey', token: 'disallowed-role-key' },
      mockDb as never,
    );

    const context = await provider.getAuthContext();

    expect(context).toBeNull();
    // last_used_at must NOT be touched for a rejected key
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('uses hourly throttle condition when touching last_used_at', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'api-key-3',
            business_id: 'business-hourly',
            role_id: 'scraper',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0 });

    const provider = new AuthContextProvider(
      mockEnv,
      { authType: 'apiKey', token: 'hourly-key' },
      mockDb as never,
    );

    const context = await provider.getAuthContext();

    expect(context?.authType).toBe('apiKey');
    const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
    expect(updateSql).toContain("last_used_at < NOW() - INTERVAL '1 hour'");
  });
});

describe('API key GraphQL integration', () => {
  const env = {
    auth0: {
      domain: 'test.auth0.com',
      audience: 'test-audience',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      managementAudience: 'https://test.auth0.com/api/v2/',
    },
  } as unknown as Environment;

  const keyRows: Record<string, ApiKeyRow> = {
    validScraperKey: {
      id: 'key-1',
      business_id: 'business-a',
      role_id: 'scraper',
      revoked_at: null,
    },
    ownerBusinessBKey: {
      id: 'key-2',
      business_id: 'business-b',
      role_id: 'accountant',
      revoked_at: null,
    },
    revokedKey: {
      id: 'key-3',
      business_id: 'business-a',
      role_id: 'scraper',
      revoked_at: new Date('2030-01-01T00:00:00.000Z'),
    },
  };

  const chargesByBusiness: Record<string, string[]> = {
    'business-a': ['charge-a1', 'charge-a2'],
    'business-b': ['charge-b1'],
  };

  function buildMockDb() {
    return {
      query: vi.fn(async (queryText: string, params: unknown[]) => {
        if (queryText.includes('FROM accounter_schema.api_keys')) {
          const hash = params[0] as string;
          const entry = Object.entries(keyRows).find(([plainKey]) => {
            return createHash('sha256').update(plainKey).digest('hex') === hash;
          });

          if (!entry) {
            return { rows: [] };
          }

          const row = entry[1];
          if (row.revoked_at) {
            return { rows: [] };
          }

          return {
            rows: [
              {
                id: row.id,
                business_id: row.business_id,
                role_id: row.role_id,
              },
            ],
          };
        }

        if (queryText.includes('SET last_used_at = NOW()')) {
          return { rowCount: 1, rows: [] };
        }

        throw new Error(`Unexpected query in test: ${queryText}`);
      }),
    };
  }

  function createTestYoga() {
    const mockDb = buildMockDb();

    const testModule = createModule({
      id: 'api-key-auth-integration',
      typeDefs: [
        gql`
          directive @requiresAuth on FIELD_DEFINITION
          directive @requiresRole(role: String!) on FIELD_DEFINITION

          type Query {
            tenantBusinessId: String! @requiresAuth
            tenantCharges: [String!]! @requiresAuth
          }

          type Mutation {
            createInvitation: Boolean! @requiresRole(role: "business_owner")
          }
        `,
      ],
      resolvers: {
        Query: {
          tenantBusinessId: async (_root: unknown, _args: unknown, context: any) => {
            const authProvider = context.injector.get(AuthContextProvider) as AuthContextProvider;
            const authContext = await authProvider.getAuthContext();
            // The @requiresAuth directive should ensure authContext is not null.
            return authContext!.tenant.businessId;
          },
          tenantCharges: async (_root: unknown, _args: unknown, context: any) => {
            const authProvider = context.injector.get(AuthContextProvider) as AuthContextProvider;
            const authContext = await authProvider.getAuthContext();
            // The @requiresAuth directive should ensure authContext is not null.
            const businessId = authContext!.tenant.businessId;

            // Simulates tenant-scoped reads (as enforced by RLS in production).
            return chargesByBusiness[businessId] ?? [];
          },
        },
        Mutation: {
          createInvitation: () => true,
        },
      },
    });

    const application = createApplication({
      modules: [testModule],
      providers: [
        {
          provide: ENVIRONMENT,
          useValue: env,
          scope: Scope.Singleton,
        },
        {
          provide: RAW_AUTH,
          useFactory: (context: { rawAuth?: { authType: 'jwt' | 'apiKey' | null; token: string | null } }) => {
            return context.rawAuth ?? { authType: null, token: null };
          },
          scope: Scope.Operation,
          deps: [CONTEXT],
        },
        {
          provide: DBProvider,
          useValue: mockDb,
          scope: Scope.Singleton,
        },
        AuthContextProvider,
      ],
    });

    const transformedSchema = authDirectiveTransformer(application.schema);

    return createYoga({
      maskedErrors: false,
      plugins: [authPlugin(), useGraphQLModules(application), useSchema(transformedSchema)],
      context: ({ request }) => {
        const apiKeyHeader = request.headers.get('x-api-key');
        const rawAuth = apiKeyHeader
          ? { authType: 'apiKey' as const, token: apiKeyHeader.trim() }
          : { authType: null, token: null };

        return {
          env,
          rawAuth,
          injector: {
            get<T>(token: unknown): T {
              if (token !== AuthContextProvider) {
                throw new Error(`Unexpected token requested: ${String(token)}`);
              }

              return new AuthContextProvider(env, rawAuth, mockDb as never) as T;
            },
          },
        };
      },
    });
  }

  it('valid X-API-Key returns 200 and tenant-scoped data', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'validScraperKey',
      },
      body: JSON.stringify({
        query: '{ tenantBusinessId tenantCharges }',
      }),
    });

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.errors).toBeUndefined();
    expect(json.data).toEqual({
      tenantBusinessId: 'business-a',
      tenantCharges: ['charge-a1', 'charge-a2'],
    });
  });

  it('invalid X-API-Key returns UNAUTHENTICATED', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'invalid-key',
      },
      body: JSON.stringify({
        query: '{ tenantBusinessId }',
      }),
    });

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeNull();
    expect(json.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('enforces business isolation for API key tenant context', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'validScraperKey',
      },
      body: JSON.stringify({
        query: '{ tenantBusinessId tenantCharges }',
      }),
    });

    const json = await response.json();

    expect(json.errors).toBeUndefined();
    expect(json.data).toEqual({
      tenantBusinessId: 'business-a',
      tenantCharges: ['charge-a1', 'charge-a2'],
    });
  });

  it('scraper API key cannot invoke createInvitation', async () => {
    const yoga = createTestYoga();

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'validScraperKey',
      },
      body: JSON.stringify({
        query: 'mutation { createInvitation }',
      }),
    });

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeNull();
    expect(json.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
