import { createYoga } from 'graphql-yoga';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { ChargesAuthorizationProvider } from '../charges-authorization.provider.js';

type RoleId = 'business_owner' | 'accountant' | 'employee' | 'scraper';

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

function createService(roleId: RoleId, chargeExists = true): ChargesAuthorizationProvider {
  const authProvider = createMockAuthProvider(roleId) as AuthContextProvider;
  const db = {
    query: vi.fn().mockResolvedValue({ rows: chargeExists ? [{ id: 'charge-1' }] : [] }),
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

  it('canWriteCharge allows business_owner and accountant; blocks employee and scraper', async () => {
    await expect(createService('business_owner').canWriteCharge()).resolves.toBeUndefined();
    await expect(createService('accountant').canWriteCharge()).resolves.toBeUndefined();

    await expect(createService('employee').canWriteCharge()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
    await expect(createService('scraper').canWriteCharge()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });

  it('canDeleteCharge allows only business_owner and returns NOT_FOUND for unknown charge', async () => {
    await expect(createService('business_owner', true).canDeleteCharge('charge-1')).resolves.toBeUndefined();

    await expect(createService('accountant').canDeleteCharge('charge-1')).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
    await expect(createService('employee').canDeleteCharge('charge-1')).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
    await expect(createService('scraper').canDeleteCharge('charge-1')).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });

    await expect(createService('business_owner', false).canDeleteCharge('missing-charge')).rejects.toMatchObject({
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
