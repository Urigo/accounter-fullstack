import { createYoga } from 'graphql-yoga';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { CONTEXT, createApplication, createModule, gql, Scope } from 'graphql-modules';
import { createYogaLogger } from '../../../../observability/log.js';
import { authPlugin } from '../../../../plugins/auth-plugin.js';
import { BUSINESS_SCOPE_HEADER } from '../../../../plugins/business-scope-header.js';
import { OPERATION_LOG_MSG, requestLogPlugin } from '../../../../plugins/request-log-plugin.js';
import { ENVIRONMENT, RAW_AUTH } from '../../../../shared/tokens.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { AuthContextProvider } from '../auth-context.provider.js';

/**
 * The request log's `businessId` through the real wiring: `authPlugin` parses `X-Business-Scope`,
 * graphql-modules injects `AuthContextProvider` per operation (with the per-module context copy), and
 * `requestLogPlugin` writes the line. Only the database is faked.
 */

const USER_ID = 'user-0001';
// The primary membership (first row, most recently updated) and a second one.
const PRIMARY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECOND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const membershipRows = {
  rows: [
    { user_id: USER_ID, business_id: PRIMARY, role_id: 'business_owner', auth0_user_id: null },
    { user_id: USER_ID, business_id: SECOND, role_id: 'business_owner', auth0_user_id: null },
  ],
  rowCount: 2,
};

function buildYoga() {
  const db = { query: vi.fn(async () => membershipRows) };
  const module = createModule({
    id: 'request-log-identity',
    typeDefs: gql`
      type Query {
        writeTarget: String
      }
    `,
    resolvers: {
      Query: {
        writeTarget: async (_parent: unknown, _args: unknown, { injector }: GraphQLModules.Context) =>
          (await injector.get(AuthContextProvider).getAuthContext())?.tenant.businessId ?? null,
      },
    },
  });
  const application = createApplication({
    modules: [module],
    providers: [
      { provide: DBProvider, useValue: db },
      { provide: ENVIRONMENT, useValue: {}, scope: Scope.Singleton },
      {
        provide: RAW_AUTH,
        useFactory: (context: GraphQLModules.GlobalContext) =>
          context.rawAuth ?? { authType: null, token: null },
        scope: Scope.Operation,
        deps: [CONTEXT],
      },
      AuthContextProvider,
    ],
  });
  return createYoga({
    logging: createYogaLogger(),
    plugins: [requestLogPlugin(), authPlugin(), useGraphQLModules(application)],
    // authPlugin checks a dev-bypass user against the pool before trusting it.
    context: () => ({ pool: db }),
  });
}

let stdout: MockInstance;
let previousAllowDevAuth: string | undefined;

beforeAll(() => {
  previousAllowDevAuth = process.env['ALLOW_DEV_AUTH'];
  process.env['ALLOW_DEV_AUTH'] = '1';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
});

afterAll(() => {
  if (previousAllowDevAuth === undefined) {
    delete process.env['ALLOW_DEV_AUTH'];
  } else {
    process.env['ALLOW_DEV_AUTH'] = previousAllowDevAuth;
  }
  vi.restoreAllMocks();
});

async function run(headers: Record<string, string>) {
  stdout.mockClear();
  const response = await buildYoga().fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-auth': USER_ID, ...headers },
    body: JSON.stringify({ query: 'query WriteTarget { writeTarget }' }),
  });
  const body = (await response.json()) as { data?: { writeTarget: string | null } };
  const operationLines = stdout.mock.calls
    .map(([chunk]) => JSON.parse(String(chunk)) as Record<string, unknown>)
    .filter(record => record['msg'] === OPERATION_LOG_MSG);
  return { writeTarget: body.data?.writeTarget, operationLines };
}

describe('request log identity through the real wiring', () => {
  it('logs the primary business without a scope header', async () => {
    const { writeTarget, operationLines } = await run({});

    expect(writeTarget).toBe(PRIMARY);
    expect(operationLines).toEqual([
      expect.objectContaining({ userId: USER_ID, businessId: PRIMARY }),
    ]);
  });

  it('logs the write target the scope header narrowed to, as the resolver sees it', async () => {
    const { writeTarget, operationLines } = await run({ [BUSINESS_SCOPE_HEADER]: SECOND });

    expect(writeTarget).toBe(SECOND);
    expect(operationLines).toEqual([
      expect.objectContaining({ userId: USER_ID, businessId: SECOND }),
    ]);
  });
});
