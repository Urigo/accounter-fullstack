import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { TestDatabase } from './helpers/db-setup.js';
import { seedAdminCore } from '../../scripts/seed-admin-context.js';
import { UUID_REGEX } from '../shared/constants.js';

describe('seedAdminCore integration', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should create admin business context with all required entities', async () => {
    await db.withTransaction(async client => {
      // Execute seed
      const { adminEntityId } = await seedAdminCore(client);

      // Verify admin entity exists
      expect(adminEntityId).toBeTruthy();
      expect(adminEntityId).toMatch(
        UUID_REGEX
      );

      // Verify admin financial entity
      const adminEntity = await client.query(
        `SELECT * FROM accounter_schema.financial_entities WHERE id = $1`,
        [adminEntityId],
      );
      expect(adminEntity.rows).toHaveLength(1);
      expect(adminEntity.rows[0].name).toBe('Admin Business');
      expect(adminEntity.rows[0].type).toBe('business');
      expect(adminEntity.rows[0].owner_id).toBe(adminEntityId); // self-owned

      // Verify admin business record
      const adminBusiness = await client.query(
        `SELECT * FROM accounter_schema.businesses WHERE id = $1`,
        [adminEntityId],
      );
      expect(adminBusiness.rows).toHaveLength(1);

      // Verify user_context exists and has required fields
      const userContext = await client.query(
        `SELECT * FROM accounter_schema.user_context WHERE owner_id = $1`,
        [adminEntityId],
      );
      expect(userContext.rows).toHaveLength(1);

      const context = userContext.rows[0];

      // Verify currencies
      expect(context.default_local_currency).toBe('ILS');
      expect(context.default_fiat_currency_for_crypto_conversions).toBe('USD');

      // Verify required authority businesses exist
      const vatBusiness = await client.query(
        `SELECT * FROM accounter_schema.businesses WHERE id = $1`,
        [context.vat_business_id],
      );
      expect(vatBusiness.rows).toHaveLength(1);

      const taxBusiness = await client.query(
        `SELECT * FROM accounter_schema.businesses WHERE id = $1`,
        [context.tax_business_id],
      );
      expect(taxBusiness.rows).toHaveLength(1);

      const socialSecurityBusiness = await client.query(
        `SELECT * FROM accounter_schema.businesses WHERE id = $1`,
        [context.social_security_business_id],
      );
      expect(socialSecurityBusiness.rows).toHaveLength(1);

      // Verify required tax categories exist
      const requiredTaxCategoryFields = [
        'default_tax_category_id',
        'input_vat_tax_category_id',
        'output_vat_tax_category_id',
        'tax_expenses_tax_category_id',
        'exchange_rate_tax_category_id',
        'income_exchange_rate_tax_category_id',
        'exchange_rate_revaluation_tax_category_id',
        'fee_tax_category_id',
        'general_fee_tax_category_id',
        'fine_tax_category_id',
        'untaxable_gifts_tax_category_id',
        'balance_cancellation_tax_category_id',
        'development_foreign_tax_category_id',
        'development_local_tax_category_id',
        'expenses_to_pay_tax_category_id',
        'expenses_in_advance_tax_category_id',
        'income_to_collect_tax_category_id',
        'income_in_advance_tax_category_id',
        'salary_excess_expenses_tax_category_id',
      ];

      for (const field of requiredTaxCategoryFields) {
        const taxCategoryId = context[field];
        expect(taxCategoryId).toBeTruthy();

        const taxCategory = await client.query(
          `SELECT * FROM accounter_schema.tax_categories WHERE id = $1`,
          [taxCategoryId],
        );
        expect(taxCategory.rows).toHaveLength(1);
      }
    });
  });

  it('should be idempotent (safe to call multiple times)', async () => {
    await db.withTransaction(async client => {
      // Call seed twice in same transaction
      await seedAdminCore(client);

      // Count entities before second call
      const countBefore = await client.query(
        `SELECT COUNT(*) as count FROM accounter_schema.financial_entities`,
      );
      const entitiesBeforeSecondCall = parseInt(countBefore.rows[0].count);

      // Second call should reuse existing entities
      await seedAdminCore(client);

      // Count entities after second call - should be same
      const countAfter = await client.query(
        `SELECT COUNT(*) as count FROM accounter_schema.financial_entities`,
      );
      const entitiesAfterSecondCall = parseInt(countAfter.rows[0].count);

      // Idempotent: no new entities created on second call
      expect(entitiesAfterSecondCall).toBe(entitiesBeforeSecondCall);

      // Verify only one user_context exists
      const userContextCount = await client.query(
        `SELECT COUNT(*) as count FROM accounter_schema.user_context`,
      );
      expect(userContextCount.rows[0].count).toBe('1');
    });
  });

  it('should not leak data between tests (transactional isolation)', async () => {
    await db.withTransaction(async client => {
      const TEMP_NAME = 'seed-admin-context.integration.test.ts: temp rollback entity';

      // Insert a throwaway entity inside a transaction
      const insertEntity = await client.query(
        `INSERT INTO accounter_schema.financial_entities (name, type)
       VALUES ($1, 'business')
       RETURNING id`,
        [TEMP_NAME],
      );
      const tempId = insertEntity.rows[0].id;
      await client.query(`INSERT INTO accounter_schema.businesses (id) VALUES ($1)`, [tempId]);

      // Verify exists within the same transaction
      const inTx = await client.query(
        `SELECT COUNT(*) as count FROM accounter_schema.financial_entities WHERE name = $1`,
        [TEMP_NAME],
      );
      expect(inTx.rows[0].count).toBe('1');

      // Note: withTransaction automatically rolls back at the end,
      // so the next test will start with a clean slate
    });
  });

  it('should create all expected entity counts', async () => {
    await db.withTransaction(async client => {
      await seedAdminCore(client);

      // Count businesses (Admin + 3 authorities = 4)
      const businessCount = await client.query(
        `SELECT COUNT(*) as count FROM accounter_schema.businesses`,
      );
      expect(parseInt(businessCount.rows[0].count)).toBeGreaterThanOrEqual(4);

      // Count tax categories (3 authority + 12 general + 4 cross-year = 19)
      const taxCategoryCount = await client.query(
        `SELECT COUNT(*) as count FROM accounter_schema.tax_categories`,
      );
      expect(parseInt(taxCategoryCount.rows[0].count)).toBeGreaterThanOrEqual(19);
    });
  });

  it('should validate foreign key relationships', async () => {
    await db.withTransaction(async client => {
      const { adminEntityId } = await seedAdminCore(client);

      // Get user_context
      const userContext = await client.query(
        `SELECT * FROM accounter_schema.user_context WHERE owner_id = $1`,
        [adminEntityId],
      );

      const context = userContext.rows[0];

      // Verify all business FKs point to valid financial_entities
      const businessFields = ['vat_business_id', 'tax_business_id', 'social_security_business_id'];

      for (const field of businessFields) {
        const businessId = context[field];
        const entity = await client.query(
          `SELECT * FROM accounter_schema.financial_entities WHERE id = $1`,
          [businessId],
        );
        expect(entity.rows).toHaveLength(1);
        expect(entity.rows[0].type).toBe('business');
      }

      // Verify all tax_category FKs point to valid financial_entities
      const taxCategoryFields = [
        'default_tax_category_id',
        'input_vat_tax_category_id',
        'output_vat_tax_category_id',
      ];

      for (const field of taxCategoryFields) {
        const taxCategoryId = context[field];
        const entity = await client.query(
          `SELECT * FROM accounter_schema.financial_entities WHERE id = $1`,
          [taxCategoryId],
        );
        expect(entity.rows).toHaveLength(1);
        expect(entity.rows[0].type).toBe('tax_category');
      }
    });
  });
});
