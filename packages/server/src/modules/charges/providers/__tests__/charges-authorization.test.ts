import { createYoga } from 'graphql-yoga';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { ChargesAuthorizationProvider } from '../charges-authorization.provider.js';

type RoleId = 'business_owner' | 'accountant' | 'employee' | 'scraper' | 'gmail_listener';

function createMockAuthProvider(roleId: RoleId): Pick<AuthContextProvider, 'getAuthContext'> {
  return {
    getAuthContext: vi.fn().mockResolvedValue({
      authType: 'jwt',
      user: {
        userId: 'user-1',
        email: `${roleId}@example.com`,
        roleId,
        permissions: [],
        emailVerified: true,
        permissionsVersion: 1,
        auth0UserId: `auth0|${roleId}`,
      },
      tenant: {
        businessId: 'biz-1',
        roleId,
      },
    }),
  };
}

function createService(
  roleId: RoleId,
  existingChargeIds: readonly string[] = ['charge-1'],
): ChargesAuthorizationProvider {
  const authProvider = createMockAuthProvider(roleId) as AuthContextProvider;
  const db = {
    query: vi.fn().mockImplementation((_query: string, values?: unknown[]) => {
      const chargeIds = Array.isArray(values?.[0]) ? (values?.[0] as string[]) : [];
      const rows = chargeIds
        .filter(chargeId => existingChargeIds.includes(chargeId))
        .map(id => ({ id }));
      return Promise.resolve({ rows });
    }),
  } as unknown as TenantAwareDBClient;

  return new ChargesAuthorizationProvider(authProvider, db);
}

describe('ChargesAuthorizationProvider', () => {
  it('canReadCharges passes for all roles', async () => {
    for (const role of ['business_owner', 'accountant', 'employee', 'scraper'] as const) {
      const service = createService(role);
      await expect(service.canReadCharges()).resolves.toBeUndefined();
    }
  });

  it('canReadCharges rejects with UNAUTHENTICATED when there is no user in auth context', async () => {
    const authProvider = {
      getAuthContext: vi.fn().mockResolvedValue({
        authType: 'jwt',
        user: null,
        tenant: null,
      }),
    } as unknown as AuthContextProvider;
    const db = {
      query: vi.fn(),
    } as unknown as TenantAwareDBClient;
    const service = new ChargesAuthorizationProvider(authProvider, db);

    await expect(service.canReadCharges()).rejects.toMatchObject({
      extensions: { code: 'UNAUTHENTICATED' },
    });
  });

  it('canWriteCharge allows business_owner, accountant, scraper and gmail_listener; blocks employee', async () => {
    await expect(createService('business_owner').canWriteCharge()).resolves.toBeUndefined();
    await expect(createService('accountant').canWriteCharge()).resolves.toBeUndefined();
    await expect(createService('scraper').canWriteCharge()).resolves.toBeUndefined();
    await expect(createService('gmail_listener').canWriteCharge()).resolves.toBeUndefined();

    await expect(createService('employee').canWriteCharge()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });

  it('canDeleteCharge allows business_owner and accountant; returns NOT_FOUND for unknown charge', async () => {
    await expect(createService('business_owner').canDeleteCharge('charge-1')).resolves.toBeUndefined();
    await expect(createService('accountant').canDeleteCharge('charge-1')).resolves.toBeUndefined();
    await expect(createService('employee').canDeleteCharge('charge-1')).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
    await expect(createService('scraper').canDeleteCharge('charge-1')).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });

    await expect(createService('business_owner', []).canDeleteCharge('missing-charge')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('canDeleteChargesByIds checks all ids in a single query and returns NOT_FOUND if any is missing', async () => {
    await expect(
      createService('business_owner', ['charge-1', 'charge-2']).canDeleteChargesByIds([
        'charge-1',
        'charge-2',
      ]),
    ).resolves.toBeUndefined();

    await expect(
      createService('business_owner', ['charge-1']).canDeleteChargesByIds(['charge-1', 'missing-charge']),
    ).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('integration: employee calling deleteCharge mutation gets FORBIDDEN', async () => {
    const testModule = createModule({
      id: 'charges-authorization-integration-test',
      typeDefs: gql`
        type Mutation {
          deleteCharge(chargeId: ID!): Boolean!
        }

        type Query {
          _empty: String
        }
      `,
      resolvers: {
        Mutation: {
          deleteCharge: async (
            _: unknown,
            args: { chargeId: string },
            context: { injector: { get: <T>(token: unknown) => T } },
          ) => {
            await (
              context.injector.get(ChargesAuthorizationProvider) as ChargesAuthorizationProvider
            ).canDeleteCharge(args.chargeId);
            return true;
          },
        },
      },
      providers: [
        ChargesAuthorizationProvider,
        {
          provide: AuthContextProvider,
          useFactory: () => createMockAuthProvider('employee'),
          scope: Scope.Operation,
        },
        {
          provide: TenantAwareDBClient,
          useFactory: () => ({
            query: vi.fn().mockResolvedValue({ rows: [{ id: 'charge-1' }] }),
          }),
          scope: Scope.Operation,
        },
      ],
    });

    const app = createApplication({ modules: [testModule] });
    const yoga = createYoga({
      maskedErrors: false,
      plugins: [useGraphQLModules(app)],
    });

    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation { deleteCharge(chargeId: "charge-1") }',
      }),
    });
    const result = await response.json();

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
