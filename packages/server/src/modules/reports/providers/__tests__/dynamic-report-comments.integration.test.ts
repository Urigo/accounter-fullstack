import { createRequire } from 'node:module';
import type { ExecutionResult, GraphQLScalarType, GraphQLSchema } from 'graphql';
import { DateTimeResolver, UUIDResolver } from 'graphql-scalars';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import {
  dropRlsRole,
  ensureRlsRole,
  RLS_TEST_ROLE,
} from '../../../../__tests__/helpers/rls-role.js';
import { testDbConfig } from '../../../../__tests__/helpers/test-db-config.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { authDirectiveTransformer } from '../../../auth/directives/auth-directives.js';
import { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import type { Auth0ManagementProvider } from '../../../auth/providers/auth0-management.provider.js';
import { BusinessUsersProvider } from '../../../auth/providers/business-users.provider.js';
import { TimelessDateScalar } from '../../../common/resolvers/timeless-date.js';
import { dynamicReportCommentsResolver } from '../../resolvers/dynamic-report-comments.resolver.js';
import { dynamicReportResolver } from '../../resolvers/dynamic-report.resolver.js';
import commentsTypeDefs from '../../typeDefs/dynamic-report-comments.graphql.js';
import { DynamicReportCommentsProvider } from '../dynamic-report-comments.provider.js';
import { DynamicReportProvider } from '../dynamic-report.provider.js';

let pool: Pool;
/** Connections that run as a non-superuser role, so the tables' RLS policies actually apply. */
let rlsPool: Pool;

// dynamic_report_templates.owner_id is an FK to businesses, so both tenants must exist. Seeded in
// beforeAll, removed in afterAll (templates, threads and comments cascade with them).
const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000008c0';
const OTHER_OWNER_ID = '00000000-0000-0000-0000-0000000008cf';
const TEMPLATE_NAME = 'comments-integration-template';

// Members of TEST_OWNER_ID. USER_1 has an Auth0 identity; USER_2 only the email they were invited
// with; FORMER_USER has no membership at all (a user who has since left).
const USER_1 = '00000000-0000-4000-8000-0000000008d1';
const USER_2 = '00000000-0000-4000-8000-0000000008d2';
const FORMER_USER = '00000000-0000-4000-8000-0000000008d3';
const USER_1_AUTH0_ID = 'auth0|dynamic-report-comments-user-1';
const USER_1_NAME = 'Grace Hopper';
const USER_2_EMAIL = 'dynamic-report-comments-user-2@example.com';

const LEAF_ID = '00000000-0000-0000-0000-0000000008e1';
const BRANCH_ID = 'branch-00000000-0000-4000-8000-0000000008e2';

const TREE = JSON.stringify([
  {
    id: BRANCH_ID,
    parent: 0,
    text: 'Assets',
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  },
  {
    id: LEAF_ID,
    parent: BRANCH_ID,
    text: 'Cash',
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false },
  },
]);

// ── Harness ──────────────────────────────────────────────────────────────────

/** The DB session identity: which tenant the RLS variables pin reads and writes to. */
function createTenantAuthContextProvider(businessId: string): AuthContextProvider {
  return {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId },
        user: {
          userId: 'api-key:test',
          auth0UserId: null,
          email: '',
          roleId: 'admin',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 0,
        },
      }),
  } as unknown as AuthContextProvider;
}

function createMockAdminContextProvider(ownerId: string): AdminContextProvider {
  return {
    getVerifiedAdminContext: () => Promise.resolve({ ownerId }),
  } as unknown as AdminContextProvider;
}

const dbClients: TenantAwareDBClient[] = [];

function createDbClient(ownerId: string, dbPool: Pool = pool) {
  const client = new TenantAwareDBClient(
    new DBProvider(dbPool),
    createTenantAuthContextProvider(ownerId),
  );
  dbClients.push(client);
  return client;
}

function createCommentsProvider(ownerId = TEST_OWNER_ID, dbPool: Pool = pool) {
  return new DynamicReportCommentsProvider(createDbClient(ownerId, dbPool));
}

function createReportProvider(ownerId = TEST_OWNER_ID) {
  return new DynamicReportProvider(
    createDbClient(ownerId),
    createMockAdminContextProvider(ownerId),
  );
}

/** An API key's synthetic id: `getActingUserId` resolves it to null. */
const API_KEY_CALLER = 'api-key:test';

/**
 * One simulated GraphQL request by `userId` (a user uuid, or an API key) acting for `ownerId`.
 * Fresh providers per call, as `Scope.Operation` gives a real request.
 */
function createContext(userId: string, { ownerId = TEST_OWNER_ID, roleId = 'accountant' } = {}) {
  const auth0 = {
    getUserProfileById: (auth0UserId: string) =>
      Promise.resolve(
        auth0UserId === USER_1_AUTH0_ID ? { name: USER_1_NAME, email: 'grace@example.com' } : null,
      ),
  } as unknown as Auth0ManagementProvider;
  const services = new Map<unknown, unknown>([
    [DynamicReportCommentsProvider, createCommentsProvider(ownerId)],
    [DynamicReportProvider, createReportProvider(ownerId)],
    [
      BusinessUsersProvider,
      new BusinessUsersProvider(createDbClient(ownerId), {} as never, auth0, {} as never),
    ],
    [AdminContextProvider, createMockAdminContextProvider(ownerId)],
    [
      AuthContextProvider,
      {
        getAuthContext: () =>
          Promise.resolve({
            authType: userId.startsWith('api-key:') ? 'apiKey' : 'jwt',
            user: { userId, roleId },
            tenant: { businessId: ownerId },
          }),
      },
    ],
  ]);
  return { injector: { get: (token: unknown) => services.get(token) } };
}

type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;
type ResolverMap = Partial<Record<string, Partial<Record<string, AnyResolver>>>>;

/**
 * `graphql` as the packages in node_modules load it. Under vitest, source files resolve `graphql` to
 * its ESM build while `@graphql-tools/utils` (and graphql-modules) load the CommonJS one, and
 * graphql-js refuses to mix schema objects across the two. Building and executing the schema with
 * the CommonJS copy keeps everything in the realm `mapSchema` checks against.
 */
const gql = createRequire(import.meta.url)('graphql') as typeof import('graphql');

/**
 * The comments SDL and resolvers as an executable schema, with the server's real scalars and auth
 * directives: operations below run through parsing, validation, the directives, the resolvers and
 * serialization, exactly as the server would run them, minus the transport.
 */
function buildCommentsSchema(): GraphQLSchema {
  const base = gql.parse(`
    directive @requiresAuth on FIELD_DEFINITION
    directive @requiresAnyRole(roles: [String!]!) on FIELD_DEFINITION
    scalar UUID
    scalar DateTime
    scalar TimelessDate
    type Query { ping: Boolean }
    type Mutation { pong: Boolean }
  `);
  // Re-created in the CommonJS realm from their configs: same parsing and serialization.
  const scalars = Object.fromEntries(
    [UUIDResolver, DateTimeResolver, TimelessDateScalar].map(scalar => [
      scalar.name,
      new gql.GraphQLScalarType((scalar as GraphQLScalarType).toConfig()),
    ]),
  );
  const resolvers = dynamicReportCommentsResolver as unknown as ResolverMap;
  const schema = mapSchema(gql.buildASTSchema(gql.concatAST([base, commentsTypeDefs])), {
    [MapperKind.SCALAR_TYPE]: type => scalars[type.name] ?? type,
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
      const resolve = resolvers[typeName]?.[fieldName];
      return resolve ? { ...fieldConfig, resolve } : fieldConfig;
    },
  });
  return authDirectiveTransformer(schema);
}

const schema = buildCommentsSchema();

async function execute(
  source: string,
  variables: Record<string, unknown>,
  context: ReturnType<typeof createContext>,
): Promise<ExecutionResult> {
  return gql.graphql({ schema, source, variableValues: variables, contextValue: context });
}

/** Runs an operation that must succeed, and returns its data. */
async function ok<T = Record<string, unknown>>(
  source: string,
  variables: Record<string, unknown>,
  context: ReturnType<typeof createContext>,
): Promise<T> {
  const result = await execute(source, variables, context);
  expect(result.errors).toBeUndefined();
  return result.data as T;
}

/** Runs an operation that must fail, and returns its first error's message and code. */
async function fails(
  source: string,
  variables: Record<string, unknown>,
  context: ReturnType<typeof createContext>,
) {
  const result = await execute(source, variables, context);
  expect(result.errors).toHaveLength(1);
  const [error] = result.errors!;
  return { message: error.message, code: error.extensions?.code };
}

const THREAD_FIELDS = `
  id
  nodeId
  nodeKind
  nodeLabel
  createdAt
  resolvedAt
  resolvedBy
  messages {
    id
    content
    createdAt
    editedAt
    deletedAt
    author
    isMine
    fromDate
    toDate
    scopeOwnerId
  }
`;

// The DateTime scalar serializes to Date objects in-process (the transport would stringify them).
type Message = {
  id: string;
  content: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  author: string | null;
  isMine: boolean;
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
};
type Thread = {
  id: string;
  nodeId: string;
  nodeKind: 'LEAF' | 'BRANCH';
  nodeLabel: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  messages: Message[];
};

const THREADS_QUERY = `
  query Threads($templateName: String!) {
    dynamicReportThreads(templateName: $templateName) { ${THREAD_FIELDS} }
  }
`;
const ADD_MUTATION = `
  mutation Add($input: AddDynamicReportCommentInput!) {
    addDynamicReportComment(input: $input) { ${THREAD_FIELDS} }
  }
`;
const EDIT_MUTATION = `
  mutation Edit($id: UUID!, $content: String!) {
    editDynamicReportComment(id: $id, content: $content) { id content editedAt deletedAt isMine }
  }
`;
const DELETE_MUTATION = `
  mutation Delete($id: UUID!) {
    deleteDynamicReportComment(id: $id) { id content editedAt deletedAt isMine }
  }
`;
const RESOLVE_MUTATION = `
  mutation Resolve($threadId: UUID!, $resolved: Boolean!) {
    setDynamicReportThreadResolved(threadId: $threadId, resolved: $resolved) { ${THREAD_FIELDS} }
  }
`;

function commentInput(overrides: Record<string, unknown> = {}) {
  return {
    templateName: TEMPLATE_NAME,
    nodeId: LEAF_ID,
    nodeKind: 'LEAF',
    nodeLabel: 'Cash',
    content: 'Why did this move?',
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
    scopeOwnerId: TEST_OWNER_ID,
    ...overrides,
  };
}

async function post(
  userId: string,
  overrides: Record<string, unknown> = {},
  options?: Parameters<typeof createContext>[1],
) {
  const data = await ok<{ addDynamicReportComment: Thread }>(
    ADD_MUTATION,
    { input: commentInput(overrides) },
    createContext(userId, options),
  );
  return data.addDynamicReportComment;
}

async function listThreads(userId: string, templateName = TEMPLATE_NAME, ownerId = TEST_OWNER_ID) {
  const data = await ok<{ dynamicReportThreads: Thread[] }>(
    THREADS_QUERY,
    { templateName },
    createContext(userId, { ownerId }),
  );
  return data.dynamicReportThreads;
}

async function resolveThread(userId: string, threadId: string, resolved: boolean) {
  const data = await ok<{ setDynamicReportThreadResolved: Thread }>(
    RESOLVE_MUTATION,
    { threadId, resolved },
    createContext(userId),
  );
  return data.setDynamicReportThreadResolved;
}

async function dbThreads(ownerId = TEST_OWNER_ID) {
  const { rows } = await pool.query(
    `SELECT * FROM accounter_schema.dynamic_report_threads
     WHERE owner_id = $1 ORDER BY created_at, id`,
    [ownerId],
  );
  return rows;
}

async function dbComments(ownerId = TEST_OWNER_ID) {
  const { rows } = await pool.query(
    `SELECT * FROM accounter_schema.dynamic_report_comments
     WHERE owner_id = $1 ORDER BY created_at, id`,
    [ownerId],
  );
  return rows;
}

async function insertTemplate(ownerId: string, name = TEMPLATE_NAME) {
  await createReportProvider(ownerId).insertTemplateWithSnapshot({
    template: { name, ownerId, template: TREE, fromDate: '2025-01-01', toDate: '2025-12-31' },
  });
}

async function cleanup() {
  await pool.query(
    'DELETE FROM accounter_schema.dynamic_report_templates WHERE owner_id = ANY($1)',
    [[TEST_OWNER_ID, OTHER_OWNER_ID]],
  );
}

async function seedBusiness(id: string, name: string) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', NULL)
     ON CONFLICT (id) DO NOTHING`,
    [id, name],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $1, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [id],
  );
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);

  await seedBusiness(TEST_OWNER_ID, 'dynamic-report-comments-test-owner');
  await seedBusiness(OTHER_OWNER_ID, 'dynamic-report-comments-other-owner');
  await pool.query(
    `INSERT INTO accounter_schema.businesses_admin (id, owner_id)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
     VALUES ($1, $2, $4, 'accountant'), ($3, NULL, $4, 'accountant')
     ON CONFLICT (user_id, business_id) DO NOTHING`,
    [USER_1, USER_1_AUTH0_ID, USER_2, TEST_OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.invitations
       (business_id, email, role_id, expires_at, token_hash, user_id)
     VALUES ($1, $2, 'accountant', now() + interval '1 day', $3, $4)`,
    [TEST_OWNER_ID, USER_2_EMAIL, 'dynamic-report-comments-test-token', USER_2],
  );

  await ensureRlsRole(pool, {
    grants: ['dynamic_report_threads', 'dynamic_report_comments'].map(table => ({
      table,
      privileges: 'SELECT, INSERT, UPDATE, DELETE',
    })),
  });
  // A superuser may SET ROLE to anyone, so every connection of this pool drops to the RLS role
  // before its first statement (pg runs a client's queries in order).
  rlsPool = new Pool({ ...testDbConfig, max: 4 });
  rlsPool.on('connect', client => {
    void client.query(`SET ROLE ${RLS_TEST_ROLE}`);
  });
});

afterAll(async () => {
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
  await rlsPool?.end();
  await dropRlsRole(pool);
  await cleanup();
  // Invitations cascade with their business_users row, which cascades with businesses_admin.
  await pool.query('DELETE FROM accounter_schema.businesses_admin WHERE id = $1', [TEST_OWNER_ID]);
  for (const id of [TEST_OWNER_ID, OTHER_OWNER_ID]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the shared pool here — it is shared with other concurrently-running suites.
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await cleanup();
  await insertTemplate(TEST_OWNER_ID);
});

afterEach(async () => {
  // Each provider is one simulated request: release its connection like the request plugin does.
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
  vi.restoreAllMocks();
});

// ── Posting and listing ──────────────────────────────────────────────────────

describe('posting and listing', () => {
  it('lists messages oldest first, with author display names and isMine', async () => {
    await post(USER_1, { content: 'first' });
    await post(USER_2, { content: 'second' });
    await post(USER_1, { content: 'third' });

    const [thread, ...rest] = await listThreads(USER_1);

    expect(rest).toEqual([]);
    expect(thread.messages.map(message => message.content)).toEqual(['first', 'second', 'third']);
    // An Auth0 name, then an invitation email for a member with no Auth0 identity.
    expect(thread.messages.map(message => message.author)).toEqual([
      USER_1_NAME,
      USER_2_EMAIL,
      USER_1_NAME,
    ]);
    expect(thread.messages.map(message => message.isMine)).toEqual([true, false, true]);
    const createdAt = thread.messages.map(message => message.createdAt.getTime());
    expect(createdAt).toEqual([...createdAt].sort((a, b) => a - b));

    // The same thread seen by the other author flips isMine.
    const [asUser2] = await listThreads(USER_2);
    expect(asUser2.messages.map(message => message.isMine)).toEqual([false, true, false]);
  });

  it('orders messages by (created_at, id), breaking created_at ties by id', async () => {
    const thread = await post(USER_1, { content: 'seed' });
    const at = '2025-06-01T12:00:00Z';
    // Inserted out of order on purpose: two share a timestamp, and the earliest has the largest id.
    await pool.query(
      `INSERT INTO accounter_schema.dynamic_report_comments
         (id, owner_id, thread_id, author_id, content, from_date, to_date, scope_owner_id, created_at)
       VALUES
         ('00000000-0000-7000-8000-00000000000b', $1, $2, $3, 'tie b', '2025-01-01', '2025-12-31', $1, $4),
         ('00000000-0000-7000-8000-00000000000a', $1, $2, $3, 'tie a', '2025-01-01', '2025-12-31', $1, $4),
         ('00000000-0000-7000-8000-0000000000ff', $1, $2, $3, 'earliest', '2025-01-01', '2025-12-31', $1,
          $4::timestamptz - interval '1 day')`,
      [TEST_OWNER_ID, thread.id, USER_1, at],
    );

    const [listed] = await listThreads(USER_1);

    expect(listed.messages.map(message => message.content)).toEqual([
      'earliest',
      'tie a',
      'tie b',
      'seed',
    ]);
  });

  it('records the view each message was written in', async () => {
    await post(USER_1, { content: 'annual' });
    await post(USER_1, {
      content: 'first half, other scope',
      fromDate: '2025-01-01',
      toDate: '2025-06-30',
      scopeOwnerId: OTHER_OWNER_ID,
    });

    const [thread] = await listThreads(USER_1);

    expect(
      thread.messages.map(({ fromDate, toDate, scopeOwnerId }) => ({
        fromDate,
        toDate,
        scopeOwnerId,
      })),
    ).toEqual([
      { fromDate: '2025-01-01', toDate: '2025-12-31', scopeOwnerId: TEST_OWNER_ID },
      { fromDate: '2025-01-01', toDate: '2025-06-30', scopeOwnerId: OTHER_OWNER_ID },
    ]);
  });

  it('stores trimmed content', async () => {
    const thread = await post(USER_1, { content: '  padded \n' });
    expect(thread.messages[0].content).toBe('padded');
    const [row] = await dbComments();
    expect(row.content).toBe('padded');
  });

  it('a second post on the same node reuses the thread and refreshes its label and kind', async () => {
    const first = await post(USER_1, { nodeLabel: 'Old label', nodeKind: 'LEAF' });
    const second = await post(USER_2, { nodeLabel: 'New label', nodeKind: 'BRANCH' });

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ nodeLabel: 'New label', nodeKind: 'BRANCH' });
    expect(second.messages).toHaveLength(2);
    expect(await dbThreads()).toHaveLength(1);
  });

  it('gives each node its own thread, listed in creation order', async () => {
    await post(USER_1, { nodeId: BRANCH_ID, nodeKind: 'BRANCH', nodeLabel: 'Assets' });
    await post(USER_1, { nodeId: LEAF_ID });
    await post(USER_2, { nodeId: BRANCH_ID, nodeKind: 'BRANCH', nodeLabel: 'Assets' });

    const threads = await listThreads(USER_1);

    expect(threads.map(thread => [thread.nodeId, thread.nodeKind, thread.messages.length])).toEqual(
      [
        [BRANCH_ID, 'BRANCH', 2],
        [LEAF_ID, 'LEAF', 1],
      ],
    );
  });

  it('returns no threads for a template without any, or one that does not exist', async () => {
    expect(await listThreads(USER_1)).toEqual([]);
    expect(await listThreads(USER_1, 'no-such-template')).toEqual([]);
  });

  it('posting to a missing template fails with NOT_FOUND and writes nothing', async () => {
    const error = await fails(
      ADD_MUTATION,
      { input: commentInput({ templateName: 'no-such-template' }) },
      createContext(USER_1),
    );

    expect(error).toEqual({
      message: 'Report template "no-such-template" not found',
      code: 'NOT_FOUND',
    });
    expect(await dbThreads()).toEqual([]);
    expect(await dbComments()).toEqual([]);
  });

  it('rejects invalid input with BAD_USER_INPUT and writes nothing', async () => {
    for (const overrides of [
      { content: ' \n ' },
      { content: 'x'.repeat(10_001) },
      { nodeId: '' },
      { nodeId: 'n'.repeat(201) },
      { fromDate: '2025-12-31', toDate: '2025-01-01' },
    ]) {
      const error = await fails(
        ADD_MUTATION,
        { input: commentInput(overrides) },
        createContext(USER_1),
      );
      expect(error.code).toBe('BAD_USER_INPUT');
    }
    expect(await dbThreads()).toEqual([]);
  });

  it('the database enforces the same content, node id and node kind bounds', async () => {
    const thread = await post(USER_1);
    const insertComment = (content: string) =>
      pool.query(
        `INSERT INTO accounter_schema.dynamic_report_comments
           (owner_id, thread_id, author_id, content, from_date, to_date, scope_owner_id)
         VALUES ($1, $2, $3, $4, '2025-01-01', '2025-12-31', $1)`,
        [TEST_OWNER_ID, thread.id, USER_1, content],
      );
    await expect(insertComment('   ')).rejects.toMatchObject({ code: '23514' });
    await expect(insertComment('x'.repeat(10_001))).rejects.toMatchObject({ code: '23514' });

    const insertThread = (nodeId: string, nodeKind: string) =>
      pool.query(
        `INSERT INTO accounter_schema.dynamic_report_threads
           (owner_id, template_name, node_id, node_kind, node_label)
         VALUES ($1, $2, $3, $4, '')`,
        [TEST_OWNER_ID, TEMPLATE_NAME, nodeId, nodeKind],
      );
    await expect(insertThread('', 'leaf')).rejects.toMatchObject({ code: '23514' });
    await expect(insertThread('n'.repeat(201), 'leaf')).rejects.toMatchObject({ code: '23514' });
    await expect(insertThread('other-node', 'LEAF')).rejects.toMatchObject({ code: '23514' });
  });

  it('assigns uuidv7 ids to threads and comments', async () => {
    const thread = await post(USER_1);
    expect(thread.id.split('-')[2]?.[0]).toBe('7');
    expect(thread.messages[0].id.split('-')[2]?.[0]).toBe('7');
  });
});

// ── Resolving ────────────────────────────────────────────────────────────────

describe('resolving', () => {
  it('resolves with a stamp and a display name, and reopens clearing both', async () => {
    const thread = await post(USER_1);

    const resolved = await resolveThread(USER_2, thread.id, true);
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolvedBy).toBe(USER_2_EMAIL);
    const [row] = await dbThreads();
    expect(row.resolved_by).toBe(USER_2);

    const reopened = await resolveThread(USER_1, thread.id, false);
    expect(reopened).toMatchObject({ resolvedAt: null, resolvedBy: null });
    const [reopenedRow] = await dbThreads();
    expect(reopenedRow).toMatchObject({ resolved_at: null, resolved_by: null });
  });

  it('resolving an already resolved thread keeps the original stamp', async () => {
    const thread = await post(USER_1);
    const first = await resolveThread(USER_1, thread.id, true);
    const second = await resolveThread(USER_2, thread.id, true);

    expect(second.resolvedAt).toEqual(first.resolvedAt);
    expect(second.resolvedBy).toBe(USER_1_NAME);
  });

  it('a post on a resolved thread reopens it', async () => {
    const thread = await post(USER_1, { content: 'question' });
    await resolveThread(USER_1, thread.id, true);

    const replied = await post(USER_2, { content: 'actually, one more thing' });

    expect(replied.id).toBe(thread.id);
    expect(replied).toMatchObject({ resolvedAt: null, resolvedBy: null });
    expect(replied.messages.map(message => message.content)).toEqual([
      'question',
      'actually, one more thing',
    ]);
    const [row] = await dbThreads();
    expect(row).toMatchObject({ resolved_at: null, resolved_by: null });
  });

  it('names a user who has left the business as null', async () => {
    const thread = await post(FORMER_USER, { content: 'from someone who left' });
    const resolved = await resolveThread(FORMER_USER, thread.id, true);

    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolvedBy).toBeNull();
    expect(resolved.messages[0].author).toBeNull();
  });

  it('fails with NOT_FOUND for an unknown thread', async () => {
    const error = await fails(
      RESOLVE_MUTATION,
      { threadId: '00000000-0000-7000-8000-000000000999', resolved: true },
      createContext(USER_1),
    );
    expect(error.code).toBe('NOT_FOUND');
  });
});

// ── Editing and deleting ─────────────────────────────────────────────────────

describe('editing and deleting', () => {
  async function postOne(userId = USER_1) {
    const thread = await post(userId, { content: 'original' });
    return thread.messages[0].id;
  }

  it('the author can edit: content is trimmed and editedAt is set', async () => {
    const id = await postOne();

    const { editDynamicReportComment: edited } = await ok<{
      editDynamicReportComment: { content: string; editedAt: Date | null; isMine: boolean };
    }>(EDIT_MUTATION, { id, content: '  revised  ' }, createContext(USER_1));

    expect(edited).toMatchObject({ content: 'revised', isMine: true });
    expect(edited.editedAt).not.toBeNull();
    const [listed] = await listThreads(USER_1);
    expect(listed.messages[0]).toMatchObject({ content: 'revised', editedAt: edited.editedAt });
  });

  it("someone else's edit fails with NOT_FOUND and changes nothing", async () => {
    const id = await postOne(USER_1);

    const error = await fails(EDIT_MUTATION, { id, content: 'hijacked' }, createContext(USER_2));

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toMatch(/not found, or it is not yours to change/);
    const [row] = await dbComments();
    expect(row).toMatchObject({ content: 'original', edited_at: null });
  });

  it('the author can delete: the delete is soft', async () => {
    const id = await postOne();

    const { deleteDynamicReportComment: deleted } = await ok<{
      deleteDynamicReportComment: { content: string | null; deletedAt: Date | null };
    }>(DELETE_MUTATION, { id }, createContext(USER_1));

    expect(deleted.content).toBeNull();
    expect(deleted.deletedAt).not.toBeNull();
    // Still listed, with the marker and no text.
    const [listed] = await listThreads(USER_1);
    expect(listed.messages).toHaveLength(1);
    expect(listed.messages[0]).toMatchObject({ id, content: null, deletedAt: deleted.deletedAt });
    expect(listed.messages[0].author).toBe(USER_1_NAME);
    // The row and its text stay in the database.
    const [row] = await dbComments();
    expect(row.content).toBe('original');
    expect(row.deleted_at).toBeInstanceOf(Date);
  });

  it('a deleted message can be neither edited nor deleted again', async () => {
    const id = await postOne();
    await ok(DELETE_MUTATION, { id }, createContext(USER_1));

    expect(
      (await fails(EDIT_MUTATION, { id, content: 'resurrected' }, createContext(USER_1))).code,
    ).toBe('NOT_FOUND');
    expect((await fails(DELETE_MUTATION, { id }, createContext(USER_1))).code).toBe('NOT_FOUND');
    const [row] = await dbComments();
    expect(row).toMatchObject({ content: 'original', edited_at: null });
  });

  it("someone else's delete fails with NOT_FOUND and changes nothing", async () => {
    const id = await postOne(USER_1);

    expect((await fails(DELETE_MUTATION, { id }, createContext(USER_2))).code).toBe('NOT_FOUND');
    const [row] = await dbComments();
    expect(row.deleted_at).toBeNull();
  });

  it('an unknown id fails with NOT_FOUND', async () => {
    const id = '00000000-0000-7000-8000-000000000998';
    expect((await fails(EDIT_MUTATION, { id, content: 'x' }, createContext(USER_1))).code).toBe(
      'NOT_FOUND',
    );
    expect((await fails(DELETE_MUTATION, { id }, createContext(USER_1))).code).toBe('NOT_FOUND');
  });

  it('empty edited content fails with BAD_USER_INPUT', async () => {
    const id = await postOne();
    expect((await fails(EDIT_MUTATION, { id, content: '  ' }, createContext(USER_1))).code).toBe(
      'BAD_USER_INPUT',
    );
  });
});

// ── Template lifecycle ───────────────────────────────────────────────────────

type AnyMutation = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;
const reportMutations = dynamicReportResolver.Mutation as unknown as Record<string, AnyMutation>;

describe('template lifecycle', () => {
  it('a template rename keeps its threads', async () => {
    const thread = await post(USER_1, { content: 'before rename' });

    await reportMutations.updateDynamicReportTemplateName(
      {},
      { name: TEMPLATE_NAME, newName: 'renamed-comments-template' },
      createContext(USER_1),
      {},
    );

    expect(await listThreads(USER_1, TEMPLATE_NAME)).toEqual([]);
    const [renamed] = await listThreads(USER_1, 'renamed-comments-template');
    expect(renamed.id).toBe(thread.id);
    expect(renamed.messages.map(message => message.content)).toEqual(['before rename']);

    // Posting under the new name continues the same thread.
    const continued = await post(USER_2, { templateName: 'renamed-comments-template' });
    expect(continued.id).toBe(thread.id);
  });

  it('deleting a template deletes its threads and their messages', async () => {
    await post(USER_1, { nodeId: LEAF_ID });
    await post(USER_1, { nodeId: BRANCH_ID, nodeKind: 'BRANCH' });

    await reportMutations.deleteDynamicReportTemplate(
      {},
      { name: TEMPLATE_NAME },
      createContext(USER_1),
      {},
    );

    expect(await dbThreads()).toEqual([]);
    expect(await dbComments()).toEqual([]);
    // A new template under the same name starts clean.
    await insertTemplate(TEST_OWNER_ID);
    expect(await listThreads(USER_1)).toEqual([]);
  });

  it('Save as new (insertDynamicReportTemplate) starts with no threads', async () => {
    const original = await post(USER_1, { content: 'on the original' });

    await reportMutations.insertDynamicReportTemplate(
      {},
      { name: 'save-as-new-comments-template', template: TREE },
      createContext(USER_1),
      {},
    );

    expect(await listThreads(USER_1, 'save-as-new-comments-template')).toEqual([]);
    // The original keeps its thread.
    const [kept] = await listThreads(USER_1);
    expect(kept.id).toBe(original.id);

    // The copy shares node ids, yet posting on the same node opens a separate thread.
    const copy = await post(USER_1, { templateName: 'save-as-new-comments-template' });
    expect(copy.id).not.toBe(original.id);
    expect(copy.messages).toHaveLength(1);
    expect(await dbThreads()).toHaveLength(2);
  });

  it('a locked template accepts comments, edits, deletes and resolves, and is not written', async () => {
    await createReportProvider().lockTemplate({ name: TEMPLATE_NAME, ownerId: TEST_OWNER_ID });
    const templateRow = async () =>
      (
        await pool.query(
          'SELECT * FROM accounter_schema.dynamic_report_templates WHERE owner_id = $1 AND name = $2',
          [TEST_OWNER_ID, TEMPLATE_NAME],
        )
      ).rows[0];
    const before = await templateRow();
    expect(before.is_locked).toBe(true);

    const thread = await post(USER_1, { content: 'reviewing a locked report' });
    const messageId = thread.messages[0].id;
    await ok(EDIT_MUTATION, { id: messageId, content: 'edited' }, createContext(USER_1));
    await resolveThread(USER_1, thread.id, true);
    await resolveThread(USER_1, thread.id, false);
    await post(USER_2, { content: 'second' });
    await ok(DELETE_MUTATION, { id: messageId }, createContext(USER_1));

    const [listed] = await listThreads(USER_1);
    expect(listed.messages.map(message => message.content)).toEqual([null, 'second']);
    expect(await templateRow()).toEqual(before);
    // Comments never write snapshots.
    const { rows: snapshots } = await pool.query(
      'SELECT id FROM accounter_schema.dynamic_report_template_snapshots WHERE owner_id = $1',
      [TEST_OWNER_ID],
    );
    expect(snapshots).toEqual([]);
  });
});

// ── Callers without a user ───────────────────────────────────────────────────

describe('callers without a user row', () => {
  it('an API key is refused every write with FORBIDDEN, and nothing is written', async () => {
    const thread = await post(USER_1, { content: 'by a person' });
    const messageId = thread.messages[0].id;
    const snapshot = { threads: await dbThreads(), comments: await dbComments() };

    const attempts: [string, Record<string, unknown>][] = [
      [ADD_MUTATION, { input: commentInput({ content: 'by a key' }) }],
      [ADD_MUTATION, { input: commentInput({ nodeId: BRANCH_ID, nodeKind: 'BRANCH' }) }],
      [EDIT_MUTATION, { id: messageId, content: 'by a key' }],
      [DELETE_MUTATION, { id: messageId }],
      [RESOLVE_MUTATION, { threadId: thread.id, resolved: true }],
    ];
    for (const [source, variables] of attempts) {
      expect(await fails(source, variables, createContext(API_KEY_CALLER))).toEqual({
        message: 'Comments need a signed-in user',
        code: 'FORBIDDEN',
      });
    }

    expect({ threads: await dbThreads(), comments: await dbComments() }).toEqual(snapshot);
  });

  it('an API key can still read threads, owning none of the messages', async () => {
    await post(USER_1, { content: 'by a person' });

    const [thread] = await listThreads(API_KEY_CALLER);

    expect(thread.messages[0]).toMatchObject({
      content: 'by a person',
      author: USER_1_NAME,
      isMine: false,
    });
  });

  it('a role outside business_owner and accountant is refused by the directives', async () => {
    const error = await fails(
      ADD_MUTATION,
      { input: commentInput() },
      createContext(USER_1, { roleId: 'employee' }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toMatch(/Requires one of roles: business_owner, accountant/);
    expect(await dbThreads()).toEqual([]);
  });
});

// ── Tenant isolation ─────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it("another tenant's context cannot change a message even as the same user (owner guard)", async () => {
    const thread = await post(USER_1, { content: 'tenant A' });
    const messageId = thread.messages[0].id;
    const asOtherTenant = () => createContext(USER_1, { ownerId: OTHER_OWNER_ID });

    expect(
      (await fails(EDIT_MUTATION, { id: messageId, content: 'x' }, asOtherTenant())).code,
    ).toBe('NOT_FOUND');
    expect((await fails(DELETE_MUTATION, { id: messageId }, asOtherTenant())).code).toBe(
      'NOT_FOUND',
    );
    expect(
      (await fails(RESOLVE_MUTATION, { threadId: thread.id, resolved: true }, asOtherTenant()))
        .code,
    ).toBe('NOT_FOUND');
    expect(await listThreads(USER_1, TEMPLATE_NAME, OTHER_OWNER_ID)).toEqual([]);
  });

  describe('row-level security (non-superuser connections)', () => {
    // Each test's writes and reads go through `rlsPool`, where Postgres evaluates the policies
    // exactly as it does for the application's role.
    const tenantA = () => createCommentsProvider(TEST_OWNER_ID, rlsPool);
    const tenantB = () => createCommentsProvider(OTHER_OWNER_ID, rlsPool);

    const threadOf = (ownerId: string, nodeId = LEAF_ID) => ({
      ownerId,
      templateName: TEMPLATE_NAME,
      nodeId,
      nodeKind: 'leaf',
      nodeLabel: 'Cash',
    });
    const commentBy = (authorId: string, content = 'hello') => ({
      authorId,
      content,
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
      scopeOwnerId: TEST_OWNER_ID,
    });

    async function seedTenantA() {
      const thread = await tenantA().addComment({
        thread: threadOf(TEST_OWNER_ID),
        comment: commentBy(USER_1, 'tenant A only'),
      });
      await tenantA().setThreadResolved({
        threadId: thread.id,
        ownerId: TEST_OWNER_ID,
        userId: USER_1,
        resolved: true,
      });
      const [comment] = await tenantA().getCommentsByThreadIdLoader.load(thread.id);
      return { thread, comment };
    }

    it('lets a tenant write and read its own threads under the policies', async () => {
      const { thread, comment } = await seedTenantA();

      const [listed] = await tenantA().getThreadsByTemplate({
        ownerId: TEST_OWNER_ID,
        templateName: TEMPLATE_NAME,
      });
      expect(listed.id).toBe(thread.id);
      expect(listed.resolved_by).toBe(USER_1);
      expect(comment.content).toBe('tenant A only');

      await expect(
        tenantA().updateCommentContent({
          id: comment.id,
          ownerId: TEST_OWNER_ID,
          userId: USER_1,
          content: 'edited under RLS',
        }),
      ).resolves.toMatchObject({ content: 'edited under RLS' });
      await expect(
        tenantA().softDeleteComment({ id: comment.id, ownerId: TEST_OWNER_ID, userId: USER_1 }),
      ).resolves.toMatchObject({ deleted_at: expect.any(Date) });
    });

    it("another tenant cannot read a tenant's threads or messages", async () => {
      const { thread } = await seedTenantA();

      await expect(
        tenantB().getThreadsByTemplate({ ownerId: TEST_OWNER_ID, templateName: TEMPLATE_NAME }),
      ).resolves.toEqual([]);
      await expect(tenantB().getCommentsByThreadIdLoader.load(thread.id)).resolves.toEqual([]);
    });

    it("another tenant cannot edit, delete or resolve a tenant's rows, even naming its owner", async () => {
      const { thread, comment } = await seedTenantA();
      const before = { threads: await dbThreads(), comments: await dbComments() };

      await expect(
        tenantB().updateCommentContent({
          id: comment.id,
          ownerId: TEST_OWNER_ID,
          userId: USER_1,
          content: 'cross-tenant edit',
        }),
      ).resolves.toBeUndefined();
      await expect(
        tenantB().softDeleteComment({ id: comment.id, ownerId: TEST_OWNER_ID, userId: USER_1 }),
      ).resolves.toBeUndefined();
      await expect(
        tenantB().setThreadResolved({
          threadId: thread.id,
          ownerId: TEST_OWNER_ID,
          userId: USER_1,
          resolved: false,
        }),
      ).resolves.toBeUndefined();

      expect({ threads: await dbThreads(), comments: await dbComments() }).toEqual(before);
    });

    it("another tenant cannot post into a tenant's template, on a new node or an existing thread", async () => {
      await seedTenantA();
      const before = { threads: await dbThreads(), comments: await dbComments() };

      for (const nodeId of [LEAF_ID, BRANCH_ID]) {
        await expect(
          tenantB().addComment({
            thread: threadOf(TEST_OWNER_ID, nodeId),
            comment: commentBy(USER_1, 'cross-tenant post'),
          }),
        ).rejects.toMatchObject({ code: '42501' });
      }

      // The existing thread was neither reopened nor relabelled, and nothing was added.
      expect({ threads: await dbThreads(), comments: await dbComments() }).toEqual(before);
    });

    it('two tenants with a same-named template each see only their own thread', async () => {
      await insertTemplate(OTHER_OWNER_ID);
      const { thread: threadA } = await seedTenantA();
      const threadB = await tenantB().addComment({
        thread: threadOf(OTHER_OWNER_ID),
        comment: { ...commentBy(USER_2, 'tenant B only'), scopeOwnerId: OTHER_OWNER_ID },
      });

      const listedByA = await tenantA().getThreadsByTemplate({
        ownerId: TEST_OWNER_ID,
        templateName: TEMPLATE_NAME,
      });
      const listedByB = await tenantB().getThreadsByTemplate({
        ownerId: OTHER_OWNER_ID,
        templateName: TEMPLATE_NAME,
      });
      expect(listedByA.map(thread => thread.id)).toEqual([threadA.id]);
      expect(listedByB.map(thread => thread.id)).toEqual([threadB.id]);
      await expect(tenantA().getCommentsByThreadIdLoader.load(threadB.id)).resolves.toEqual([]);
    });
  });
});
