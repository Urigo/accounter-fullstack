import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
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

function createProvider(ownerId = TEST_OWNER_ID) {
  const dbClient = new TenantAwareDBClient(
    new DBProvider(pool),
    createMockAuthContextProvider(ownerId),
  );
  return new DynamicReportProvider(dbClient, createMockAdminContextProvider(ownerId));
}

async function cleanup() {
  await pool.query(
    'DELETE FROM accounter_schema.dynamic_report_templates WHERE owner_id = $1',
    [TEST_OWNER_ID],
  );
}

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
      snapshot: { ...baseSnapshot, leafFingerprints: null, leafApprovals: null },
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
