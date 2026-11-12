import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { seedAdminOnce } from '../../../../__tests__/helpers/db-fixtures.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { AdminContextProvider } from '../admin-context.provider.js';

/*
 * `updateSecuritiesContext` patches the `user_context.securities_context` jsonb document: read,
 * merged and written back whole, under a row lock. The provider does not validate ids (the
 * resolver does), so the ids here are made up and need not exist.
 */

let pool: Pool;
let ownerId: string;
let originalSecuritiesContext: unknown;
let ownTaxCategoryId: string;

const DIVIDEND_INCOME_ID = '0190a1b2-0000-7000-8000-0000000000d1';
const WITHHOLDING_ID = '0190a1b2-0000-7000-8000-0000000000d2';
const GAIN_ID = '0190a1b2-0000-7000-8000-0000000000d3';
const FEES_PLACEHOLDER_ID = '0190a1b2-0000-7000-8000-0000000000d4';

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

/** A provider as one request sees it: its own DB session */
function createProvider() {
  const authContextProvider = createMockAuthContextProvider(ownerId);
  const dbClient = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  return new AdminContextProvider(authContextProvider, dbClient);
}

async function storedSecuritiesContext() {
  const { rows } = await pool.query(
    'SELECT securities_context FROM accounter_schema.user_context WHERE owner_id = $1',
    [ownerId],
  );
  return rows[0].securities_context;
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await seedAdminOnce(pool);

  const { rows } = await pool.query(
    `SELECT uc.owner_id, uc.securities_context
     FROM accounter_schema.user_context uc
     INNER JOIN accounter_schema.financial_entities fe ON fe.id = uc.owner_id
     WHERE fe.name = 'Admin Business' AND fe.type = 'business'
     LIMIT 1`,
  );
  ownerId = rows[0].owner_id;
  originalSecuritiesContext = rows[0].securities_context;

  const legacy = await pool.query(
    `SELECT foreign_securities_business_id, foreign_securities_fees_category_id
     FROM accounter_schema.user_context WHERE owner_id = $1`,
    [ownerId],
  );
  originalLegacyColumns = {
    businessId: legacy.rows[0].foreign_securities_business_id,
    feesCategoryId: legacy.rows[0].foreign_securities_fees_category_id,
  };

  // the legacy columns are foreign keys: use a real tax category of the owner
  const taxCategory = await pool.query(
    'SELECT id FROM accounter_schema.tax_categories WHERE owner_id = $1 LIMIT 1',
    [ownerId],
  );
  ownTaxCategoryId = taxCategory.rows[0].id;
});

let originalLegacyColumns: { businessId: string | null; feesCategoryId: string | null };

beforeEach(async () => {
  await pool.query(
    `UPDATE accounter_schema.user_context
     SET securities_context = '{}',
         foreign_securities_business_id = NULL,
         foreign_securities_fees_category_id = NULL
     WHERE owner_id = $1`,
    [ownerId],
  );
});

afterAll(async () => {
  await pool.query(
    `UPDATE accounter_schema.user_context
     SET securities_context = $2,
         foreign_securities_business_id = $3,
         foreign_securities_fees_category_id = $4
     WHERE owner_id = $1`,
    [
      ownerId,
      originalSecuritiesContext,
      originalLegacyColumns.businessId,
      originalLegacyColumns.feesCategoryId,
    ],
  );
  // Do NOT close the pool here — it is shared with other suites and torn down by global setup.
});

describe('AdminContextProvider.updateSecuritiesContext', () => {
  it('stores a patch and reads it back into the admin context', async () => {
    const context = await createProvider().updateSecuritiesContext({
      sortCode: 990,
      taxCategories: [
        { key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: DIVIDEND_INCOME_ID },
        { key: 'FOREIGN_DIVIDEND_WITHHOLDING_TAX', taxCategoryId: WITHHOLDING_ID },
      ],
    });

    expect(context.foreignSecurities).toMatchObject({
      sortCode: 990,
      taxCategories: {
        FOREIGN_DIVIDEND_INCOME: DIVIDEND_INCOME_ID,
        FOREIGN_DIVIDEND_WITHHOLDING_TAX: WITHHOLDING_ID,
      },
    });
    expect(await storedSecuritiesContext()).toEqual({
      sortCode: 990,
      taxCategories: {
        foreignDividendIncome: DIVIDEND_INCOME_ID,
        foreignDividendWithholdingTax: WITHHOLDING_ID,
      },
    });
  });

  it('changes only the keys a later patch names', async () => {
    await createProvider().updateSecuritiesContext({
      sortCode: 990,
      taxCategories: [
        { key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: DIVIDEND_INCOME_ID },
        { key: 'FOREIGN_DIVIDEND_WITHHOLDING_TAX', taxCategoryId: WITHHOLDING_ID },
      ],
    });

    await createProvider().updateSecuritiesContext({
      taxCategories: [
        { key: 'FOREIGN_DIVIDEND_WITHHOLDING_TAX', taxCategoryId: null },
        { key: 'FOREIGN_SECURITIES_SALE_GAIN', taxCategoryId: GAIN_ID },
      ],
    });

    expect(await storedSecuritiesContext()).toEqual({
      sortCode: 990,
      taxCategories: {
        foreignDividendIncome: DIVIDEND_INCOME_ID,
        foreignSecuritiesSaleGain: GAIN_ID,
      },
    });
  });

  it('waits for a concurrent writer and merges onto what it wrote', async () => {
    // Another request holds the row and is about to store a key of its own. Merging onto the value
    // read before that write commits would silently drop it.
    const otherRequest = await pool.connect();
    try {
      await otherRequest.query('BEGIN');
      await otherRequest.query(
        'SELECT 1 FROM accounter_schema.user_context WHERE owner_id = $1 FOR UPDATE',
        [ownerId],
      );

      const update = createProvider().updateSecuritiesContext({
        taxCategories: [{ key: 'FOREIGN_SECURITIES_SALE_GAIN', taxCategoryId: GAIN_ID }],
      });
      // let the provider reach the locked row before the other request writes
      await new Promise(resolve => setTimeout(resolve, 200));

      await otherRequest.query(
        'UPDATE accounter_schema.user_context SET securities_context = $2 WHERE owner_id = $1',
        [ownerId, { taxCategories: { foreignDividendIncome: DIVIDEND_INCOME_ID } }],
      );
      await otherRequest.query('COMMIT');
      await update;
    } finally {
      otherRequest.release();
    }

    expect(await storedSecuritiesContext()).toEqual({
      taxCategories: {
        foreignDividendIncome: DIVIDEND_INCOME_ID,
        foreignSecuritiesSaleGain: GAIN_ID,
      },
    });
  });

  it('ignores the deprecated foreign securities columns', async () => {
    await pool.query(
      `UPDATE accounter_schema.user_context
       SET foreign_securities_business_id = $1, foreign_securities_fees_category_id = $2
       WHERE owner_id = $1`,
      [ownerId, ownTaxCategoryId],
    );

    const context = await createProvider().getVerifiedAdminContext();

    expect(context.foreignSecurities).toMatchObject({
      foreignSecuritiesBusinessId: null,
      foreignSecuritiesFeesCategoryId: null,
      taxCategories: {},
    });
  });

  it('stores the deprecated updateAdminContext inputs in securities_context only', async () => {
    await createProvider().updateSecuritiesContext({
      taxCategories: [{ key: 'FOREIGN_SECURITIES_FEES', taxCategoryId: FEES_PLACEHOLDER_ID }],
    });

    const context = await createProvider().updateAdminContext({
      foreignSecuritiesFeesCategoryId: ownTaxCategoryId,
    } as never);

    expect(context?.foreignSecurities.foreignSecuritiesFeesCategoryId).toBe(ownTaxCategoryId);
    expect(await storedSecuritiesContext()).toEqual({
      taxCategories: { foreignSecuritiesFees: ownTaxCategoryId },
    });
    const { rows } = await pool.query(
      `SELECT foreign_securities_fees_category_id
       FROM accounter_schema.user_context WHERE owner_id = $1`,
      [ownerId],
    );
    expect(rows[0].foreign_securities_fees_category_id).toBeNull();
  });
});
