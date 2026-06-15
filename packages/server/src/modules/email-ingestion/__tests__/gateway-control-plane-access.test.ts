import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { createApplication, createModule, gql, Scope } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { authDirectiveTransformer } from '../../auth/directives/auth-directives.js';

/**
 * Role isolation tests for the gateway control-plane identity.
 *
 * Verifies that:
 * - gateway_control_plane role can call operations protected by @requiresRole(role: "gateway_control_plane")
 * - gmail_listener role cannot call operations protected by @requiresRole(role: "gateway_control_plane")
 * - gateway_control_plane role cannot call operations protected by @requiresRole(role: "gmail_listener")
 */

function makeYoga(roleId: string | null) {
  const testModule = createModule({
    id: 'gcp-access-test',
    typeDefs: [
      gql`
        directive @requiresAuth on FIELD_DEFINITION
        directive @requiresRole(role: String!) on FIELD_DEFINITION

        type Query {
          noop: String
        }

        type Mutation {
          " Mirrors requestIngestControl: requires gateway_control_plane role "
          requestIngestControl: String! @requiresAuth @requiresRole(role: "gateway_control_plane")
          " Mirrors insertEmailDocuments: requires gmail_listener role "
          insertEmailDocuments: String! @requiresAuth @requiresRole(role: "gmail_listener")
        }
      `,
    ],
    resolvers: {
      Query: { noop: () => null },
      Mutation: {
        requestIngestControl: () => 'control-ok',
        insertEmailDocuments: () => 'ingest-ok',
      },
    },
    providers: [
      {
        provide: AuthContextProvider,
        useFactory: () => ({
          getAuthContext: async () => {
            if (!roleId) return null;
            return {
              authType: roleId === 'gateway_control_plane' ? 'gatewayControlPlane' : 'apiKey',
              user: { roleId },
              tenant: { businessId: '' },
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
          if (token !== AuthContextProvider) return undefined;
          return {
            getAuthContext: async () => {
              if (!roleId) return null;
              return {
                authType: roleId === 'gateway_control_plane' ? 'gatewayControlPlane' : 'apiKey',
                user: { roleId },
                tenant: { businessId: '' },
              };
            },
          };
        },
      },
    }),
  });
}

async function execute(yoga: ReturnType<typeof makeYoga>, query: string) {
  const response = await yoga.fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return response.json();
}

describe('gateway_control_plane role isolation', () => {
  it('gateway_control_plane can call requestIngestControl', async () => {
    const yoga = makeYoga('gateway_control_plane');
    const result = await execute(yoga, 'mutation { requestIngestControl }');

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ requestIngestControl: 'control-ok' });
  });

  it('gmail_listener cannot call requestIngestControl (FORBIDDEN)', async () => {
    const yoga = makeYoga('gmail_listener');
    const result = await execute(yoga, 'mutation { requestIngestControl }');

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('gateway_control_plane cannot call insertEmailDocuments (FORBIDDEN)', async () => {
    const yoga = makeYoga('gateway_control_plane');
    const result = await execute(yoga, 'mutation { insertEmailDocuments }');

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('unauthenticated request is rejected (UNAUTHENTICATED)', async () => {
    const yoga = makeYoga(null);
    const result = await execute(yoga, 'mutation { requestIngestControl }');

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
