import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from '../../../../__tests__/helpers/rls-role.js';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import { SecurityBusinessesProvider } from '../security-businesses.provider.js';

let pool: Pool;

// Both new tables carry a NOT NULL owner_id FK, so the tenants this suite acts as must exist
// in accounter_schema.businesses. Seeded in beforeAll, removed in afterAll.
const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000006f0';
const OTHER_OWNER_ID = '00000000-0000-0000-0000-0000000006f1';
const GENERAL_SECURITIES_BUSINESS_ID = '00000000-0000-0000-0000-0000000006f2';

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

/**
 * Only the fields ensureSecurityBusiness reads. The general foreign-securities business is a
 * real row (seeded below) so the inheritance of sort code / IRS code / country is exercised
 * rather than stubbed.
 */
function createMockAdminContextProvider(ownerId: string): AdminContextProvider {
  return {
    getVerifiedAdminContext: () =>
      Promise.resolve({
        ownerId,
        foreignSecurities: {
          foreignSecuritiesBusinessId: GENERAL_SECURITIES_BUSINESS_ID,
          foreignSecuritiesFeesCategoryId: null,
        },
      }),
  } as unknown as AdminContextProvider;
}

function createProvider(ownerId = TEST_OWNER_ID) {
  const dbClient = new TenantAwareDBClient(
    new DBProvider(pool),
    createMockAuthContextProvider(ownerId),
  );
  const adminContextProvider = createMockAdminContextProvider(ownerId);
  const businessesProvider = new BusinessesProvider(dbClient, adminContextProvider);
  const taxCategoriesProvider = new TaxCategoriesProvider(dbClient, adminContextProvider);
  const financialEntitiesProvider = new FinancialEntitiesProvider(
    dbClient,
    businessesProvider,
    // BusinessesOperationProvider is only used by delete/replace paths this suite never takes.
    {} as never,
    taxCategoriesProvider,
  );

  return new SecurityBusinessesProvider(
    dbClient,
    adminContextProvider,
    financialEntitiesProvider,
    businessesProvider,
    taxCategoriesProvider,
  );
}

const APPLE = {
  isin: 'US0378331005',
  symbol: 'AAPL',
  engName: 'APPLE INC',
  hebName: 'אפל',
  exchange: 'NYQ',
  currencyCode: 'USD',
  isForeign: true,
};

/**
 * `financial_entities.owner_id` is an FK to `businesses`, so a tenant's own row must be
 * self-owned (entity first with a null owner, then the business pointing at itself).
 */
async function seedBusiness(id: string, ownerId: string | null, name: string) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, ownerId],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $2, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [id, ownerId ?? id],
  );
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);

  for (const [index, ownerId] of [TEST_OWNER_ID, OTHER_OWNER_ID].entries()) {
    await seedBusiness(ownerId, null, `security-businesses-test-owner-${index}`);
  }
  await seedBusiness(GENERAL_SECURITIES_BUSINESS_ID, TEST_OWNER_ID, 'Foreign Securities');

  await ensureRlsRole(pool, {
    grants: [
      { table: 'businesses_securities', privileges: 'SELECT' },
      { table: 'security_identifiers', privileges: 'SELECT' },
    ],
  });
});

afterAll(async () => {
  await dropRlsRole(pool);
  // businesses_securities and security_identifiers cascade with the owning business.
  for (const id of [GENERAL_SECURITIES_BUSINESS_ID, TEST_OWNER_ID, OTHER_OWNER_ID]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE owner_id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE owner_id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

// DELETE rather than TRUNCATE CASCADE: TRUNCATE takes ACCESS EXCLUSIVE locks that deadlock
// against concurrently-running integration suites. Scoped to this suite's owners.
beforeEach(async () => {
  const owners = [TEST_OWNER_ID, OTHER_OWNER_ID];
  await pool.query(
    `DELETE FROM accounter_schema.businesses
     WHERE owner_id = ANY($1)
       AND id IN (SELECT id FROM accounter_schema.businesses_securities)`,
    [owners],
  );
  await pool.query(
    `DELETE FROM accounter_schema.financial_entities
     WHERE owner_id = ANY($1)
       AND id NOT IN ($2, $3, $4)`,
    [owners, TEST_OWNER_ID, OTHER_OWNER_ID, GENERAL_SECURITIES_BUSINESS_ID],
  );
});

describe('ensureSecurityBusiness', () => {
  it('creates a business named after the security and marks it as one', async () => {
    const provider = createProvider();

    const security = await provider.ensureSecurityBusiness(APPLE);

    expect(security.isin).toBe(APPLE.isin);
    expect(security.owner_id).toBe(TEST_OWNER_ID);
    expect(security.symbol).toBe('AAPL');

    const { rows } = await pool.query(
      `SELECT fe.name, fe.type, b.hebrew_name, b.country
       FROM accounter_schema.financial_entities fe
       INNER JOIN accounter_schema.businesses b USING (id)
       WHERE fe.id = $1`,
      [security.id],
    );
    expect(rows[0]).toMatchObject({
      name: 'APPLE INC (AAPL)',
      type: 'business',
      hebrew_name: 'אפל',
      country: 'ISR',
    });
  });

  it('normalizes the currency the feed reports into the closed type', async () => {
    const provider = createProvider();

    // The Poalim securities feed spells its currencies out in Hebrew.
    const security = await provider.ensureSecurityBusiness({
      ...APPLE,
      currencyCode: 'דולר ארה"ב',
    });

    expect(security.currency_code).toBe('USD');
  });

  it('leaves the currency empty rather than failing on a label it cannot resolve', async () => {
    const provider = createProvider();

    const security = await provider.ensureSecurityBusiness({
      ...APPLE,
      currencyCode: 'ZZZ',
    });

    expect(security.currency_code).toBeNull();
    expect(security.isin).toBe(APPLE.isin);
  });

  it('does not read a missing currency as the local one', async () => {
    const provider = createProvider();

    const security = await provider.ensureSecurityBusiness({ ...APPLE, currencyCode: '  ' });

    expect(security.currency_code).toBeNull();
  });

  it('is idempotent per ISIN — a second call returns the same business', async () => {
    const provider = createProvider();

    const first = await provider.ensureSecurityBusiness(APPLE);
    const second = await provider.ensureSecurityBusiness({ ...APPLE, engName: 'APPLE INCORPORATED' });

    expect(second.id).toBe(first.id);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS count FROM accounter_schema.businesses_securities WHERE owner_id = $1',
      [TEST_OWNER_ID],
    );
    expect(rows[0].count).toBe(1);
  });

  /**
   * The provider's queries carry no owner_id predicate — RLS is what scopes them. The test
   * pool connects as postgres (BYPASSRLS), so asserting this through the provider would
   * prove nothing; this runs the same query shape under a non-superuser role, which is the
   * boundary the server actually operates behind.
   */
  it("does not expose another tenant's securities under the tenant_isolation policy", async () => {
    const security = await createProvider(TEST_OWNER_ID).ensureSecurityBusiness(APPLE);
    await createProvider(TEST_OWNER_ID).linkIdentifier(
      security.id,
      'POALIM_SECURITY_KEY',
      '5129523',
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Session variables must be set as superuser, before privileges are dropped.
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [
        OTHER_OWNER_ID,
      ]);

      const rows = await runAsRlsRole(client, async () => {
        const securities = await client.query(
          'SELECT isin FROM accounter_schema.businesses_securities',
        );
        const identifiers = await client.query(
          'SELECT identifier_value FROM accounter_schema.security_identifiers',
        );
        return [...securities.rows, ...identifiers.rows];
      });

      expect(rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('linkIdentifier', () => {
  it('resolves a Poalim security key to its security business', async () => {
    const provider = createProvider();
    const security = await provider.ensureSecurityBusiness(APPLE);

    await provider.linkIdentifier(security.id, 'POALIM_SECURITY_KEY', '5129523');

    const found = await provider.getSecurityBusinessByIdentifierLoader.load({
      type: 'POALIM_SECURITY_KEY',
      value: '5129523',
    });
    expect(found?.id).toBe(security.id);
  });

  it('collapses several Poalim keys onto one ISIN, and is a no-op when repeated', async () => {
    const provider = createProvider();
    const security = await provider.ensureSecurityBusiness(APPLE);

    await provider.linkIdentifier(security.id, 'POALIM_SECURITY_KEY', '5129523');
    await provider.linkIdentifier(security.id, 'POALIM_SECURITY_KEY', '5129523');
    await provider.linkIdentifier(security.id, 'POALIM_SECURITY_KEY', '7654321');

    const identifiers = await provider.getIdentifiersByBusinessIdLoader.load(security.id);
    expect(identifiers.map(identifier => identifier.identifier_value)).toEqual([
      '5129523',
      '7654321',
    ]);
  });

  it('returns null for an unknown identifier', async () => {
    const provider = createProvider();

    const found = await provider.getSecurityBusinessByIdentifierLoader.load({
      type: 'POALIM_SECURITY_KEY',
      value: '0000001',
    });

    expect(found).toBeNull();
  });
});
