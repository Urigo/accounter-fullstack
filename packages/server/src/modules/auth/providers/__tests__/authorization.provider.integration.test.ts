import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { AuthContextProvider } from '../auth-context.provider.js';
import { AuthorizationProvider } from '../authorization.provider.js';

describe('AuthorizationProvider DI Integration', () => {
  it('resolves from operation injector with AuthContextProvider dependency', async () => {
    const testModule = createModule({
      id: 'authorization-provider-di-test',
      typeDefs: gql`
        type Query {
          _empty: String
        }
      `,
      providers: [
        AuthorizationProvider,
        {
          provide: AuthContextProvider,
          useFactory: () => ({
            getAuthContext: async () => ({
              authType: 'jwt',
              user: {
                userId: 'user-1',
                email: 'owner@example.com',
                roleId: 'business_owner',
                permissions: [],
                emailVerified: true,
                permissionsVersion: 1,
              },
              tenant: {
                businessId: 'biz-1',
                roleId: 'business_owner',
              },
            }),
          }),
          scope: Scope.Operation,
        },
      ],
    });

    const app = createApplication({ modules: [testModule] });

    const op1 = app.createOperationController({ context: {} });
    const authorization1 = op1.injector.get(AuthorizationProvider);

    expect(authorization1).toBeDefined();

    const user = await authorization1.requireAuth();
    expect(user.roleId).toBe('business_owner');

    const op2 = app.createOperationController({ context: {} });
    const authorization2 = op2.injector.get(AuthorizationProvider);

    expect(authorization2).toBeDefined();
    expect(authorization1).not.toBe(authorization2);

    await op1.destroy();
    await op2.destroy();
  });
});
