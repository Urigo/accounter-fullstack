import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { seedAdminOnce } from '../../../../__tests__/helpers/db-fixtures.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { AdminContextProvider } from '../admin-context.provider.js';

let pool: Pool;
let ownerId: string;

const SECURITY_BUSINESS_ID = '00000000-0000-0000-0000-0000000006f5';

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

function createProvider() {
  const dbClient = new TenantAwareDBClient(
    new DBProvider(pool),
    createMockAuthContextProvider(ownerId),
  );
  return new AdminContextProvider(createMockAuthContextProvider(ownerId), dbClient);
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  // The seeded admin business is the one with a user_context row to normalize.
  await seedAdminOnce(pool);

  const { rows } = await pool.query(
    `SELECT uc.owner_id
     FROM accounter_schema.user_context uc
     INNER JOIN accounter_schema.financial_entities fe ON fe.id = uc.owner_id
     WHERE fe.name = 'Admin Business' AND fe.type = 'business'
     LIMIT 1`,
  );
  ownerId = rows[0].owner_id;

  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, 'ADMIN CONTEXT TEST SECURITY (TST)', 'business', $2)
     ON CONFLICT (id) DO NOTHING`,
    [SECURITY_BUSINESS_ID, ownerId],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $2, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [SECURITY_BUSINESS_ID, ownerId],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM accounter_schema.businesses_securities WHERE id = $1', [
    SECURITY_BUSINESS_ID,
  ]);
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [SECURITY_BUSINESS_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [
    SECURITY_BUSINESS_ID,
  ]);
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

/**
 * `internalWalletsIds` is what keeps a securities movement internal: it drives the ledger's
 * counterparty override, fee classification, and the balance report's internal-transfer
 * filter. Once a trade's counterparty is the security rather than the general
 * foreign-securities business, all three depend on the security being in this list.
 */
describe('admin context internal wallets', () => {
  it('does not list a security business before one exists', async () => {
    const context = await createProvider().getVerifiedAdminContext();

    expect(context.financialAccounts.internalWalletsIds).not.toContain(SECURITY_BUSINESS_ID);
  });

  it('lists every security business as an internal wallet', async () => {
    await pool.query(
      `INSERT INTO accounter_schema.businesses_securities (id, owner_id, isin, symbol, eng_name)
       VALUES ($1, $2, 'US0000000000', 'TST', 'ADMIN CONTEXT TEST SECURITY')
       ON CONFLICT (id) DO NOTHING`,
      [SECURITY_BUSINESS_ID, ownerId],
    );

    const context = await createProvider().getVerifiedAdminContext();

    expect(context.financialAccounts.internalWalletsIds).toContain(SECURITY_BUSINESS_ID);
    // The general business stays in the list; the securities are additions, not a replacement.
    expect(context.financialAccounts.internalWalletsIds).toEqual(
      expect.arrayContaining([SECURITY_BUSINESS_ID]),
    );
  });
});
