import { EventEmitter } from 'node:events';
import { parse } from 'graphql';
import { createApplication, createModule, gql, type Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { dbCleanupPlugin } from '../../../plugins/db-cleanup-plugin.js';
import type { AccounterContext } from '../../../shared/types/index.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../db.provider.js';
import { getTenantDbClientStats, TenantAwareDBClient } from '../tenant-db-client.js';

class FakePoolClient extends EventEmitter {
  query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  release = vi.fn();
}

/**
 * Drives TenantAwareDBClient through the real graphql-modules execution
 * lifecycle, with dbCleanupPlugin's hooks around it as Yoga calls them.
 *
 * The client does not see the Yoga context: graphql-modules injects a
 * per-module copy taken when the module context is first built, and builds a
 * fresh, empty one for a client constructed after the operation is destroyed.
 * Unit tests that hand the constructor a plain object cannot show either.
 */
describe('TenantAwareDBClient across the graphql-modules execution lifecycle', () => {
  function setup() {
    const poolClient = new FakePoolClient();
    const connect = vi.fn().mockResolvedValue(poolClient);
    const providers = createModule({
      id: 'providers',
      typeDefs: gql`
        type Query {
          ping: String
        }
      `,
      providers: [
        TenantAwareDBClient,
        { provide: DBProvider, useValue: { pool: { connect } } },
        {
          provide: AuthContextProvider,
          useValue: {
            getAuthContext: () =>
              Promise.resolve({
                authType: 'jwt',
                user: { userId: 'user-1' },
                tenant: { businessId: 'business-1' },
                activeReadScope: { businessIds: ['business-1'] },
              }),
          },
        },
      ],
    });

    const captured: {
      client?: TenantAwareDBClient;
      injector?: Injector;
      inFlightDuringExecution?: boolean;
    } = {};
    const charges = createModule({
      id: 'charges',
      typeDefs: gql`
        extend type Query {
          charges: String
        }
      `,
      resolvers: {
        Query: {
          charges: async (_: unknown, __: unknown, { injector }: GraphQLModules.Context) => {
            captured.injector = injector;
            captured.client = injector.get(TenantAwareDBClient);
            await captured.client.query('SELECT 1');
            captured.inFlightDuringExecution = captured.client.operationInFlight;
            return 'ok';
          },
        },
      },
    });

    const app = createApplication({ modules: [providers, charges] });
    return { app, poolClient, captured };
  }

  async function runRequest(app: ReturnType<typeof setup>['app']) {
    const plugin = dbCleanupPlugin();
    const context = {} as AccounterContext;
    const document = parse('query Charges { charges }');
    plugin.onContextBuilding!({ context } as never);
    const hooks = plugin.onExecute!({
      args: { contextValue: context, document, operationName: 'Charges' },
    } as never) as { onExecuteDone: (payload: { result: unknown }) => Promise<void> };

    // createExecution destroys the operation (and its contexts) once execute
    // settles — before Yoga's onExecuteDone runs.
    const result = await app.createExecution()({ schema: app.schema, document, contextValue: context });
    await hooks.onExecuteDone({ result });
    return { result, context };
  }

  it('sees execution end, and is disposed with its request', async () => {
    const { app, poolClient, captured } = setup();

    const { result } = await runRequest(app);

    expect(result).toEqual({ data: { charges: 'ok' } });
    expect(captured.inFlightDuringExecution).toBe(true);
    // A flag assigned on the Yoga context after the module context was built
    // never reached the client's copy, so this read `true` forever.
    expect(captured.client!.operationInFlight).toBe(false);
    expect(captured.client!.operationName).toBe('Charges');
    expect(poolClient.release).toHaveBeenCalled();
    expect(getTenantDbClientStats().holdingConnection).toBe(0);
  });

  it('holds no connection when constructed after its operation was destroyed', async () => {
    const { app, poolClient, captured } = setup();
    await runRequest(app);
    poolClient.release.mockClear();
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    // Work that outlived its request asks the same injector for a client.
    const late = captured.injector!.get(TenantAwareDBClient);
    await late.query('SELECT 2');

    expect(late).not.toBe(captured.client);
    expect(late.autoRelease).toBe(true);
    expect(poolClient.release).toHaveBeenCalled();
    expect(getTenantDbClientStats().holdingConnection).toBe(0);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"db-client-outside-live-request"'));
    stdout.mockRestore();
  });
});
