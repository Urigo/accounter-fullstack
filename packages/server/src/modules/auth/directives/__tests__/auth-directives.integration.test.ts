import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { authDirectiveTransformer } from '../auth-directives.js';
import { AuthContextProvider } from '../../providers/auth-context.provider.js';

function createTestYoga(roleId: string | null) {
  const testModule = createModule({
    id: 'test-auth-directives',
    typeDefs: [
      gql`
        directive @requiresAuth on FIELD_DEFINITION
        directive @requiresRole(role: String!) on FIELD_DEFINITION
        directive @requiresAnyRole(roles: [String!]!) on FIELD_DEFINITION

        type Query {
          protectedQuery: String! @requiresAuth
        }

        type Mutation {
          ownerMutation: String! @requiresRole(role: "business_owner")
        }
      `,
    ],
    resolvers: {
      Query: {
        protectedQuery: () => 'query-ok',
      },
      Mutation: {
        ownerMutation: () => 'mutation-ok',
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
              user: {
                roleId,
              },
              tenant: {
                businessId: 'biz-1',
              },
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

describe('auth directives integration', () => {
  it('executes protected query as authenticated user', async () => {
    const yoga = createTestYoga('accountant');
    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ protectedQuery }' }),
    });

    const json = await response.json();
    expect(json.errors).toBeUndefined();
    expect(json.data).toEqual({ protectedQuery: 'query-ok' });
  });

  it('fails protected query as unauthenticated user with UNAUTHENTICATED', async () => {
    const yoga = createTestYoga(null);
    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ protectedQuery }' }),
    });

    const json = await response.json();
    expect(json.data).toBeNull();
    expect(json.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('fails role-restricted mutation for wrong role with FORBIDDEN', async () => {
    const yoga = createTestYoga('accountant');
    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { ownerMutation }' }),
    });

    const json = await response.json();
    expect(json.data).toBeNull();
    expect(json.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('executes role-restricted mutation for correct role', async () => {
    const yoga = createTestYoga('business_owner');
    const response = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { ownerMutation }' }),
    });

    const json = await response.json();
    expect(json.errors).toBeUndefined();
    expect(json.data).toEqual({ ownerMutation: 'mutation-ok' });
  });
});