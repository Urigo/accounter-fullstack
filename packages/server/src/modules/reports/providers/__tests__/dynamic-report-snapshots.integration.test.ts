import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { dynamicReportResolver } from '../../resolvers/dynamic-report.resolver.js';
import { DynamicReportProvider } from '../dynamic-report.provider.js';

let pool: Pool;

// dynamic_report_templates.owner_id is an FK to businesses, so the tenant this suite acts as must
// exist. Seeded in beforeAll, removed in afterAll (templates and snapshots cascade with it).
const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000007a0';
const TEMPLATE_NAME = 'snapshot-approvals-integration-template';

function createMockAuthContextProvider(businessId: string): AuthContextProvider {
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

function createProvider(ownerId = TEST_OWNER_ID) {
  const dbClient = new TenantAwareDBClient(
    new DBProvider(pool),
    createMockAuthContextProvider(ownerId),
  );
  dbClients.push(dbClient);
  return new DynamicReportProvider(dbClient, createMockAdminContextProvider(ownerId));
}

async function cleanup() {
  await pool.query(
    'DELETE FROM accounter_schema.dynamic_report_templates WHERE owner_id = $1',
    [TEST_OWNER_ID],
  );
}

const snapshotKey = {
  ownerId: TEST_OWNER_ID,
  templateName: TEMPLATE_NAME,
  fromDate: '2025-01-01',
  toDate: '2025-12-31',
  scopeOwnerId: TEST_OWNER_ID,
};

const baseSnapshot = {
  ownerId: TEST_OWNER_ID,
  templateName: TEMPLATE_NAME,
  fromDate: '2025-01-01',
  toDate: '2025-12-31',
  scopeOwnerId: TEST_OWNER_ID,
  tree: '[]',
  leafValues: JSON.stringify({ a: 1 }),
  createdBy: null,
};

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);

  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', NULL)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID, 'dynamic-report-snapshots-test-owner'],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $1, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID],
  );
});

afterAll(async () => {
  await cleanup();
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [TEST_OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [
    TEST_OWNER_ID,
  ]);
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

afterEach(async () => {
  // Each provider is one simulated request: release its connection like the request plugin does.
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await cleanup();
  await createProvider().insertTemplateWithSnapshot({
    template: {
      name: TEMPLATE_NAME,
      ownerId: TEST_OWNER_ID,
      template: '[]',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
    },
  });
});

describe('DynamicReportProvider snapshots', () => {
  it('round-trips leaf_fingerprints and leaves leaf_approvals null when not given', async () => {
    const provider = createProvider();

    const inserted = await provider.insertSnapshot({
      ...baseSnapshot,
      leafFingerprints: JSON.stringify({ a: 'x' }),
      leafApprovals: null,
    });
    expect(inserted?.id).toBeDefined();

    const snapshot = await provider.getSnapshotById({ id: inserted!.id });

    expect(snapshot?.leaf_fingerprints).toEqual({ a: 'x' });
    expect(snapshot?.leaf_approvals).toBeNull();
    expect(snapshot?.leaf_values).toEqual({ a: 1 });
  });

  it('round-trips leaf_approvals', async () => {
    const provider = createProvider();
    const approvals = {
      a: { status: 'APPROVED', setBy: 'user-1', setAt: '2025-06-01T00:00:00.000Z', system: false },
    };

    const inserted = await provider.insertSnapshot({
      ...baseSnapshot,
      leafFingerprints: null,
      leafApprovals: JSON.stringify(approvals),
    });
    const snapshot = await provider.getSnapshotById({ id: inserted!.id });

    expect(snapshot?.leaf_fingerprints).toBeNull();
    expect(snapshot?.leaf_approvals).toEqual(approvals);
  });

  it('keeps both columns null for a snapshot written inside a template save', async () => {
    const provider = createProvider();

    await provider.updateTemplateWithSnapshot({
      template: {
        name: TEMPLATE_NAME,
        ownerId: TEST_OWNER_ID,
        template: '[]',
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
      },
      snapshot: {
        key: snapshotKey,
        buildSnapshot: () => ({ ...baseSnapshot, leafFingerprints: null, leafApprovals: null }),
      },
    });

    const { rows } = await pool.query(
      `SELECT leaf_fingerprints, leaf_approvals
       FROM accounter_schema.dynamic_report_template_snapshots
       WHERE owner_id = $1 AND template_name = $2`,
      [TEST_OWNER_ID, TEMPLATE_NAME],
    );
    expect(rows).toEqual([{ leaf_fingerprints: null, leaf_approvals: null }]);
  });
});

describe('DynamicReportProvider.getLatestComparableSnapshot', () => {
  it('returns the newest snapshot with the same template, period and scope', async () => {
    const provider = createProvider();
    const row = { ...baseSnapshot, leafFingerprints: null, leafApprovals: null };

    const older = await provider.insertSnapshot(row);
    const newer = await provider.insertSnapshot(row);
    // Other periods and another scope owner, written after the match: must be ignored.
    await provider.insertSnapshot({ ...row, fromDate: '2025-02-01' });
    await provider.insertSnapshot({ ...row, toDate: '2025-06-30' });
    await provider.insertSnapshot({ ...row, scopeOwnerId: OTHER_SCOPE_ID });

    const latest = await createProvider().getLatestComparableSnapshot(snapshotKey);
    expect(latest?.id).toBe(newer!.id);
    expect(latest?.id).not.toBe(older!.id);
  });

  it('returns null when only non-comparable snapshots exist', async () => {
    const provider = createProvider();
    await provider.insertSnapshot({
      ...baseSnapshot,
      toDate: '2025-06-30',
      leafFingerprints: null,
      leafApprovals: null,
    });

    await expect(createProvider().getLatestComparableSnapshot(snapshotKey)).resolves.toBeNull();
  });
});

// ── Stamped approvals through the resolvers ──────────────────────────────────

const LEAF_A = '00000000-0000-0000-0000-0000000007a1';
const LEAF_B = '00000000-0000-0000-0000-0000000007a2';
const LEAF_C = '00000000-0000-0000-0000-0000000007a3';
const OTHER_SCOPE_ID = '00000000-0000-0000-0000-0000000007af';
const OUTSIDE_TREE = '00000000-0000-0000-0000-0000000007ff';
const USER_1 = '00000000-0000-4000-8000-0000000007b1';
const USER_2 = '00000000-0000-4000-8000-0000000007b2';

const TREE = JSON.stringify([
  { id: 1, parent: 0, text: 'Root', droppable: true, data: { nodeType: 'synthetic-branch', isOpen: true } },
  ...[LEAF_A, LEAF_B, LEAF_C].map(id => ({
    id,
    parent: 1,
    text: id,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false },
  })),
]);

type Status = 'APPROVED' | 'PENDING' | 'UNAPPROVED';

function snapshotInput(
  approvals: Record<string, Status> | undefined,
  fingerprints: Record<string, string> = {},
) {
  return {
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
    scopeOwnerId: TEST_OWNER_ID,
    values: [LEAF_A, LEAF_B, LEAF_C].map(entityId => ({
      entityId,
      value: 1,
      fingerprint: fingerprints[entityId] ?? `fp-${entityId}`,
    })),
    ...(approvals
      ? {
          approvals: Object.entries(approvals).map(([entityId, status]) => ({ entityId, status })),
        }
      : {}),
  };
}

/** One simulated GraphQL request, acting as `userId`. */
function createContext(userId: string | null) {
  const services = new Map<unknown, unknown>([
    [DynamicReportProvider, createProvider()],
    [AdminContextProvider, createMockAdminContextProvider(TEST_OWNER_ID)],
    [
      AuthContextProvider,
      {
        getAuthContext: () =>
          Promise.resolve(userId ? { user: { userId }, tenant: { businessId: TEST_OWNER_ID } } : null),
      },
    ],
  ]);
  return { injector: { get: (token: unknown) => services.get(token) } };
}

type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;
const mutations = dynamicReportResolver.Mutation as unknown as Record<string, AnyResolver>;

function capture(userId: string | null, snapshot: ReturnType<typeof snapshotInput>) {
  return mutations.captureDynamicReportBaseline(
    {},
    { name: TEMPLATE_NAME, tree: TREE, snapshot },
    createContext(userId),
    {},
  );
}

function resave(userId: string | null, snapshot: ReturnType<typeof snapshotInput>) {
  return mutations.updateDynamicReportTemplate(
    {},
    { name: TEMPLATE_NAME, template: TREE, snapshot },
    createContext(userId),
    {},
  );
}

async function snapshotRows() {
  const { rows } = await pool.query(
    `SELECT id, leaf_approvals, leaf_fingerprints, created_by
     FROM accounter_schema.dynamic_report_template_snapshots
     WHERE owner_id = $1 AND template_name = $2
     ORDER BY created_at ASC`,
    [TEST_OWNER_ID, TEMPLATE_NAME],
  );
  return rows as {
    id: string;
    leaf_approvals: Record<string, { status: Status; setBy: string | null; setAt: string; system: boolean }> | null;
    leaf_fingerprints: Record<string, string> | null;
    created_by: string | null;
  }[];
}

describe('dynamic report approvals write path', () => {
  it('capture stamps approvals; a second capture carries unchanged stamps and stamps changes', async () => {
    await capture(USER_1, snapshotInput({ [LEAF_A]: 'APPROVED', [LEAF_B]: 'PENDING', [LEAF_C]: 'UNAPPROVED' }));
    const [first] = await snapshotRows();

    expect(first.created_by).toBe(USER_1);
    expect(first.leaf_approvals).toEqual({
      [LEAF_A]: { status: 'APPROVED', setBy: USER_1, setAt: expect.any(String), system: false },
      [LEAF_B]: { status: 'PENDING', setBy: USER_1, setAt: expect.any(String), system: false },
    });

    await capture(USER_2, snapshotInput({ [LEAF_A]: 'APPROVED', [LEAF_B]: 'APPROVED', [LEAF_C]: 'UNAPPROVED' }));
    const [, second] = await snapshotRows();

    expect(second.created_by).toBe(USER_2);
    // Unchanged: the first stamp is carried forward verbatim.
    expect(second.leaf_approvals![LEAF_A]).toEqual(first.leaf_approvals![LEAF_A]);
    // Changed: a new stamp by the second user.
    expect(second.leaf_approvals![LEAF_B]).toMatchObject({
      status: 'APPROVED',
      setBy: USER_2,
      system: false,
    });
    expect(second.leaf_approvals![LEAF_B].setAt).not.toBe(first.leaf_approvals![LEAF_B].setAt);
    expect(second.leaf_approvals![LEAF_C]).toBeUndefined();
  });

  it('a previously APPROVED leaf arriving PENDING with a changed fingerprint gets a system stamp', async () => {
    await resave(USER_1, snapshotInput({ [LEAF_A]: 'APPROVED', [LEAF_B]: 'APPROVED' }));
    await resave(
      USER_2,
      snapshotInput(
        { [LEAF_A]: 'PENDING', [LEAF_B]: 'PENDING' },
        { [LEAF_A]: 'fp-changed' }, // LEAF_B keeps its fingerprint: a manual change.
      ),
    );
    const [, second] = await snapshotRows();

    expect(second.leaf_approvals![LEAF_A]).toEqual({
      status: 'PENDING',
      setBy: null,
      setAt: expect.any(String),
      system: true,
    });
    expect(second.leaf_approvals![LEAF_B]).toMatchObject({
      status: 'PENDING',
      setBy: USER_2,
      system: false,
    });
    expect(second.leaf_fingerprints![LEAF_A]).toBe('fp-changed');
  });

  it('stamps against the previous snapshot of the same period and scope only', async () => {
    await capture(USER_1, snapshotInput({ [LEAF_A]: 'APPROVED' }));
    // A different period in between must not become the previous row.
    await capture(USER_2, { ...snapshotInput({ [LEAF_A]: 'PENDING' }), toDate: '2025-06-30' });
    await capture(USER_2, snapshotInput({ [LEAF_A]: 'APPROVED' }));
    const [first, , third] = await snapshotRows();

    expect(third.leaf_approvals![LEAF_A]).toEqual(first.leaf_approvals![LEAF_A]);
  });

  it('concurrent saves serialize: the later one stamps against the row the earlier one wrote', async () => {
    await Promise.all([
      capture(USER_1, snapshotInput({ [LEAF_A]: 'APPROVED' })),
      resave(USER_2, snapshotInput({ [LEAF_A]: 'APPROVED' })),
      capture(USER_2, snapshotInput({ [LEAF_A]: 'APPROVED' })),
    ]);
    const rows = await snapshotRows();

    expect(rows).toHaveLength(3);
    // Whichever committed first stamped it; everyone after carried that stamp forward.
    for (const row of rows) {
      expect(row.leaf_approvals![LEAF_A]).toEqual(rows[0].leaf_approvals![LEAF_A]);
    }
  });

  it('capture on a locked template writes approvals and leaves the template row untouched', async () => {
    await createProvider().lockTemplate({ name: TEMPLATE_NAME, ownerId: TEST_OWNER_ID });
    const { rows: before } = await pool.query(
      'SELECT * FROM accounter_schema.dynamic_report_templates WHERE owner_id = $1 AND name = $2',
      [TEST_OWNER_ID, TEMPLATE_NAME],
    );

    await capture(USER_1, snapshotInput({ [LEAF_A]: 'APPROVED' }));

    const { rows: after } = await pool.query(
      'SELECT * FROM accounter_schema.dynamic_report_templates WHERE owner_id = $1 AND name = $2',
      [TEST_OWNER_ID, TEMPLATE_NAME],
    );
    expect(after).toEqual(before);
    const [row] = await snapshotRows();
    expect(row.leaf_approvals![LEAF_A]).toMatchObject({ status: 'APPROVED', setBy: USER_1 });
  });

  it('capture of a missing template fails and writes nothing', async () => {
    await expect(
      mutations.captureDynamicReportBaseline(
        {},
        { name: 'no-such-template', tree: TREE, snapshot: snapshotInput({ [LEAF_A]: 'APPROVED' }) },
        createContext(USER_1),
        {},
      ),
    ).rejects.toThrow(/Failed to capture baseline/);
    expect(await snapshotRows()).toEqual([]);
  });

  it('insert stores no approvals whatever the input says, but does set created_by', async () => {
    await cleanup();
    await mutations.insertDynamicReportTemplate(
      {},
      { name: TEMPLATE_NAME, template: TREE, snapshot: snapshotInput({ [LEAF_A]: 'APPROVED' }) },
      createContext(USER_1),
      {},
    );
    const [row] = await snapshotRows();

    expect(row.leaf_approvals).toBeNull();
    expect(row.created_by).toBe(USER_1);
  });

  it('a save without approvals stores an empty approvals object', async () => {
    await resave(USER_1, snapshotInput(undefined));
    const [row] = await snapshotRows();

    expect(row.leaf_approvals).toEqual({});
    expect(row.created_by).toBe(USER_1);
  });

  it('records created_by as null for a caller with no user row behind it', async () => {
    await capture('api-key:test', snapshotInput({ [LEAF_A]: 'APPROVED' }));
    const [row] = await snapshotRows();

    expect(row.created_by).toBeNull();
    expect(row.leaf_approvals![LEAF_A]).toMatchObject({ setBy: null, system: false });
  });

  it('drops approvals for entities outside the submitted tree and logs a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await capture(USER_1, snapshotInput({ [LEAF_A]: 'APPROVED', [OUTSIDE_TREE]: 'APPROVED' }));
    const [row] = await snapshotRows();

    expect(Object.keys(row.leaf_approvals!)).toEqual([LEAF_A]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('not leaves of the submitted tree'),
      expect.objectContaining({ entityIds: [OUTSIDE_TREE] }),
    );
  });
});
