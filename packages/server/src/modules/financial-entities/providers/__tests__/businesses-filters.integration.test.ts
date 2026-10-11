import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { BusinessesProvider, type BusinessesFiltersParams } from '../businesses.provider.js';

let pool: Pool;

const OWNER_ID = '00000000-0000-0000-0000-00000000bf00';
const TAX_CATEGORY_A = '00000000-0000-0000-0000-00000000bf01';
const TAX_CATEGORY_B = '00000000-0000-0000-0000-00000000bf02';
const ACME = '00000000-0000-0000-0000-00000000bf10';
const BETA = '00000000-0000-0000-0000-00000000bf11';
const GAMMA = '00000000-0000-0000-0000-00000000bf12';
const DELTA = '00000000-0000-0000-0000-00000000bf13';
const SORT_CODE_SUPPLIERS = 9101;
const SORT_CODE_CUSTOMERS = 9102;

type SeededBusiness = {
  id: string;
  name: string;
  hebrewName: string | null;
  sortCode: number | null;
  country: string;
  taxCategoryId: string | null;
  isClient: boolean;
  isAdmin: boolean;
  isActive: boolean;
};

/**
 * One business per interesting combination. Names carry the LIKE metacharacters `%` and `_` so
 * the free-text filter is shown to match them literally.
 */
const BUSINESSES: SeededBusiness[] = [
  {
    id: ACME,
    name: 'Acme Ltd',
    hebrewName: 'אקמה',
    sortCode: SORT_CODE_SUPPLIERS,
    country: 'ISR',
    taxCategoryId: TAX_CATEGORY_A,
    isClient: true,
    isAdmin: false,
    isActive: true,
  },
  {
    id: BETA,
    name: 'Beta Supplies',
    hebrewName: null,
    sortCode: SORT_CODE_CUSTOMERS,
    country: 'USA',
    taxCategoryId: TAX_CATEGORY_B,
    isClient: false,
    isAdmin: false,
    isActive: false,
  },
  {
    id: GAMMA,
    name: 'Gamma 100% Pure',
    hebrewName: 'גמא',
    sortCode: null,
    country: 'GBR',
    taxCategoryId: null,
    isClient: false,
    isAdmin: true,
    isActive: true,
  },
  {
    id: DELTA,
    name: 'Delta_Co',
    hebrewName: null,
    sortCode: SORT_CODE_SUPPLIERS,
    country: 'ISR',
    taxCategoryId: null,
    isClient: true,
    isAdmin: false,
    isActive: true,
  },
];

const SEEDED_IDS = new Set(BUSINESSES.map(business => business.id));
const ALL_NAMES = BUSINESSES.map(business => business.name).sort();

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

function createProvider(): BusinessesProvider {
  const dbClient = new TenantAwareDBClient(
    new DBProvider(pool),
    createMockAuthContextProvider(OWNER_ID),
  );
  const adminContextProvider = {
    getVerifiedAdminContext: () => Promise.resolve({ ownerId: OWNER_ID }),
  } as unknown as AdminContextProvider;
  return new BusinessesProvider(dbClient, adminContextProvider);
}

/**
 * Names of this suite's businesses that match. The test pool connects as a BYPASSRLS superuser,
 * and other suites seed businesses concurrently, so the result is narrowed to the rows seeded
 * here rather than asserted whole.
 */
async function matchingNames(filters: BusinessesFiltersParams): Promise<string[]> {
  const businesses = await createProvider().getBusinessesByFilters(filters);
  return businesses
    .filter(business => SEEDED_IDS.has(business.id))
    .map(business => business.name)
    .sort();
}

async function cleanUp() {
  const ids = [...SEEDED_IDS];
  await pool.query(
    'DELETE FROM accounter_schema.business_tax_category_match WHERE business_id = ANY($1)',
    [ids],
  );
  await pool.query('DELETE FROM accounter_schema.clients WHERE business_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM accounter_schema.businesses_admin WHERE id = ANY($1)', [ids]);
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = ANY($1)', [ids]);
  await pool.query('DELETE FROM accounter_schema.tax_categories WHERE id = ANY($1)', [
    [TAX_CATEGORY_A, TAX_CATEGORY_B],
  ]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = ANY($1)', [
    [...ids, TAX_CATEGORY_A, TAX_CATEGORY_B],
  ]);
  await pool.query('DELETE FROM accounter_schema.sort_codes WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [OWNER_ID]);
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await cleanUp();

  // `financial_entities.owner_id` is an FK to `businesses`, so the tenant's own row must be
  // self-owned (entity first with a null owner, then the business pointing at itself).
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, 'businesses-filters-test-owner', 'business', NULL)`,
    [OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country) VALUES ($1, $1, 'ISR')`,
    [OWNER_ID],
  );

  for (const [key, name] of [
    [SORT_CODE_SUPPLIERS, 'Suppliers'],
    [SORT_CODE_CUSTOMERS, 'Customers'],
  ] as const) {
    await pool.query(
      'INSERT INTO accounter_schema.sort_codes (key, name, owner_id) VALUES ($1, $2, $3)',
      [key, name, OWNER_ID],
    );
  }

  for (const [id, name] of [
    [TAX_CATEGORY_A, 'Office supplies'],
    [TAX_CATEGORY_B, 'Consulting'],
  ] as const) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
       VALUES ($1, $2, 'tax_category', $3)`,
      [id, name, OWNER_ID],
    );
    await pool.query('INSERT INTO accounter_schema.tax_categories (id, owner_id) VALUES ($1, $2)', [
      id,
      OWNER_ID,
    ]);
  }

  for (const business of BUSINESSES) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id, sort_code, is_active)
       VALUES ($1, $2, 'business', $3, $4, $5)`,
      [business.id, business.name, OWNER_ID, business.sortCode, business.isActive],
    );
    await pool.query(
      `INSERT INTO accounter_schema.businesses (id, owner_id, country, hebrew_name)
       VALUES ($1, $2, $3, $4)`,
      [business.id, OWNER_ID, business.country, business.hebrewName],
    );
    if (business.taxCategoryId) {
      await pool.query(
        `INSERT INTO accounter_schema.business_tax_category_match (business_id, owner_id, tax_category_id)
         VALUES ($1, $2, $3)`,
        [business.id, OWNER_ID, business.taxCategoryId],
      );
    }
    if (business.isClient) {
      await pool.query(
        `INSERT INTO accounter_schema.clients (business_id, green_invoice_id, owner_id)
         VALUES ($1, $2, $3)`,
        [business.id, randomUUID(), OWNER_ID],
      );
    }
    if (business.isAdmin) {
      await pool.query(
        'INSERT INTO accounter_schema.businesses_admin (id, owner_id) VALUES ($1, $2)',
        [business.id, OWNER_ID],
      );
    }
  }
});

afterAll(async () => {
  await cleanUp();
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

describe('BusinessesProvider.getBusinessesByFilters', () => {
  it('returns every business when no filter is set', async () => {
    expect(await matchingNames({})).toEqual(ALL_NAMES);
  });

  describe('name', () => {
    it('matches a case-insensitive substring of the name', async () => {
      expect(await matchingNames({ name: 'ACME' })).toEqual(['Acme Ltd']);
    });

    it('matches the Hebrew name', async () => {
      expect(await matchingNames({ name: 'גמא' })).toEqual(['Gamma 100% Pure']);
    });

    it('treats LIKE metacharacters literally', async () => {
      expect(await matchingNames({ name: '%' })).toEqual(['Gamma 100% Pure']);
      expect(await matchingNames({ name: '_' })).toEqual(['Delta_Co']);
    });

    it('ignores a blank name', async () => {
      expect(await matchingNames({ name: '   ' })).toEqual(ALL_NAMES);
    });
  });

  describe('tax category', () => {
    it('matches businesses linked to any of the given categories', async () => {
      expect(await matchingNames({ taxCategoryIds: [TAX_CATEGORY_A] })).toEqual(['Acme Ltd']);
      expect(await matchingNames({ taxCategoryIds: [TAX_CATEGORY_A, TAX_CATEGORY_B] })).toEqual([
        'Acme Ltd',
        'Beta Supplies',
      ]);
    });

    it('matches businesses with no linked category', async () => {
      expect(await matchingNames({ withoutTaxCategory: true })).toEqual([
        'Delta_Co',
        'Gamma 100% Pure',
      ]);
    });

    it('ORs the category list with "no category"', async () => {
      expect(
        await matchingNames({ taxCategoryIds: [TAX_CATEGORY_A], withoutTaxCategory: true }),
      ).toEqual(['Acme Ltd', 'Delta_Co', 'Gamma 100% Pure']);
    });

    it('treats withoutTaxCategory: false as unset', async () => {
      expect(await matchingNames({ withoutTaxCategory: false })).toEqual(ALL_NAMES);
    });
  });

  describe('sort code', () => {
    it('matches businesses under any of the given sort codes', async () => {
      expect(await matchingNames({ sortCodes: [SORT_CODE_SUPPLIERS] })).toEqual([
        'Acme Ltd',
        'Delta_Co',
      ]);
    });

    it('matches businesses with no sort code', async () => {
      expect(await matchingNames({ withoutSortCode: true })).toEqual(['Gamma 100% Pure']);
    });

    it('ORs the sort code list with "no sort code"', async () => {
      expect(
        await matchingNames({ sortCodes: [SORT_CODE_CUSTOMERS], withoutSortCode: true }),
      ).toEqual(['Beta Supplies', 'Gamma 100% Pure']);
    });
  });

  it('matches any of the given countries, case-insensitively', async () => {
    expect(await matchingNames({ countries: ['ISR'] })).toEqual(['Acme Ltd', 'Delta_Co']);
    expect(await matchingNames({ countries: ['usa', 'gbr'] })).toEqual([
      'Beta Supplies',
      'Gamma 100% Pure',
    ]);
  });

  it('narrows to clients and non-clients', async () => {
    expect(await matchingNames({ isClient: true })).toEqual(['Acme Ltd', 'Delta_Co']);
    expect(await matchingNames({ isClient: false })).toEqual(['Beta Supplies', 'Gamma 100% Pure']);
  });

  it('narrows to active and inactive businesses', async () => {
    expect(await matchingNames({ isActive: false })).toEqual(['Beta Supplies']);
    expect(await matchingNames({ isActive: true })).toEqual([
      'Acme Ltd',
      'Delta_Co',
      'Gamma 100% Pure',
    ]);
  });

  it('narrows to admin and non-admin businesses', async () => {
    expect(await matchingNames({ isAdmin: true })).toEqual(['Gamma 100% Pure']);
    expect(await matchingNames({ isAdmin: false })).toEqual([
      'Acme Ltd',
      'Beta Supplies',
      'Delta_Co',
    ]);
  });

  it('ANDs different filters together', async () => {
    expect(
      await matchingNames({
        countries: ['ISR'],
        isClient: true,
        sortCodes: [SORT_CODE_SUPPLIERS],
        withoutTaxCategory: true,
      }),
    ).toEqual(['Delta_Co']);
  });
});
