import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { AuthContextProvider } from '../../providers/auth-context.provider.js';
import { authDirectiveTransformer } from '../auth-directives.js';

function createUnitYoga(roleId: string | null) {
  const testModule = createModule({
    id: 'auth-directive-unit-test',
    typeDefs: [
      gql`
        directive @requiresAuth on FIELD_DEFINITION
        directive @requiresRole(role: String!) on FIELD_DEFINITION
        directive @requiresAnyRole(roles: [String!]!) on FIELD_DEFINITION

        type Query {
          secure: String! @requiresAuth
          ownerOnly: String! @requiresRole(role: "business_owner")
          ownerOrAccountant: String!
            @requiresAnyRole(roles: ["business_owner", "accountant"])
          secureOwnerOnly: String! @requiresAuth @requiresRole(role: "business_owner")
        }
      `,
    ],
    resolvers: {
      Query: {
        secure: () => 'secure-ok',
        ownerOnly: () => 'owner-ok',
        ownerOrAccountant: () => 'any-role-ok',
        secureOwnerOnly: () => 'stacked-ok',
      },
    },
    providers: [
      {
        provide: AuthContextProvider,
        useFactory: () => ({
          getAuthContext: async () => {
            if (!roleId) {
              return null;
            }
            return {
              authType: 'jwt',
              user: { roleId },
              tenant: { businessId: 'biz-1' },
            };
          },
        }),
        scope: Scope.Operation,
      },
    ],
  });

  const application = createApplication({ modules: [testModule] });
  const transformedSchema = authDirectiveTransformer(application.schema);

  return createYoga({
    maskedErrors: false,
    plugins: [useGraphQLModules(application), useSchema(transformedSchema)],
    context: () => ({
      injector: {
        get: (token: unknown) => {
          if (token !== AuthContextProvider) {
            return undefined;
          }

          return {
            getAuthContext: async () => {
              if (!roleId) {
                return null;
              }
              return {
                authType: 'jwt',
                user: { roleId },
                tenant: { businessId: 'biz-1' },
              };
            },
          };
        },
      },
    }),
  });
}

async function execute(yoga: ReturnType<typeof createUnitYoga>, query: string) {
  const response = await yoga.fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return response.json();
}

describe('authDirectiveTransformer', () => {
  it('@requiresAuth passes when auth context exists', async () => {
    const yoga = createUnitYoga('business_owner');
    const result = await execute(yoga, '{ secure }');

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ secure: 'secure-ok' });
  });

  it('@requiresAuth throws UNAUTHENTICATED when user is missing', async () => {
    const yoga = createUnitYoga(null);
    const result = await execute(yoga, '{ secure }');

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('@requiresRole passes when role matches', async () => {
    const yoga = createUnitYoga('business_owner');
    const result = await execute(yoga, '{ ownerOnly }');

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ ownerOnly: 'owner-ok' });
  });

  it('@requiresRole throws FORBIDDEN when role does not match', async () => {
    const yoga = createUnitYoga('accountant');
    const result = await execute(yoga, '{ ownerOnly }');

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('@requiresAnyRole passes when any role matches', async () => {
    const yoga = createUnitYoga('accountant');
    const result = await execute(yoga, '{ ownerOrAccountant }');

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ ownerOrAccountant: 'any-role-ok' });
  });

  it('@requiresAnyRole throws UNAUTHENTICATED when user is missing', async () => {
    const yoga = createUnitYoga(null);
    const result = await execute(yoga, '{ ownerOrAccountant }');

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('stacked directives enforce authentication and role', async () => {
    const unauthenticatedYoga = createUnitYoga(null);
    const unauthenticatedResult = await execute(unauthenticatedYoga, '{ secureOwnerOnly }');
    expect(unauthenticatedResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');

    const forbiddenYoga = createUnitYoga('accountant');
    const forbiddenResult = await execute(forbiddenYoga, '{ secureOwnerOnly }');
    expect(forbiddenResult.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
