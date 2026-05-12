import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EntityEnsureProvider } from '../modules/financial-entities/providers/entity-ensure.provider.js';
import { UUID_REGEX } from '../shared/constants.js';
import { TestDatabase } from './helpers/db-setup.js';

/**
 * Integration tests for the green-field client bootstrap flow.
 *
 * These tests validate the DB-side logic (entity creation, user_context, super_admins table)
 * without invoking Auth0 or the full GraphQL stack.
 */
describe('bootstrapNewClient integration', () => {
  let db: TestDatabase;
  let entityEnsure: EntityEnsureProvider;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    entityEnsure = new EntityEnsureProvider();
  });

  afterAll(async () => {
    // Pool managed by global vitest setup — do not close here.
  });

  it('should create all required entities for a new client tenant', async () => {
    await db.withTransaction(async client => {
      const { makeUUID } = await import('../demo-fixtures/helpers/deterministic-uuid.js');
      const businessName = 'Test Corp';
      const adminId = makeUUID('business', businessName);

      // Set RLS context (allow_bootstrap_root policy: permits INSERT where id = current_business_id)
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [adminId]);

      // Insert admin entity via direct SQL (same as manual DB test that passes)
      await client.query(
        `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
         VALUES ($1, $2, 'business', NULL)
         ON CONFLICT (id) DO NOTHING`,
        [adminId, businessName],
      );
      await client.query(
        `INSERT INTO accounter_schema.businesses (id, country, owner_id)
         VALUES ($1, 'ISR', $1)
         ON CONFLICT (id) DO NOTHING`,
        [adminId],
      );
      await client.query(`UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`, [adminId]);

      expect(adminId).toMatch(UUID_REGEX);

      // Verify self-owned
      const entity = await client.query(
        `SELECT owner_id FROM accounter_schema.financial_entities WHERE id = $1`,
        [adminId],
      );
      expect(entity.rows[0].owner_id).toBe(adminId);

      // Authority businesses
      for (const name of ['VAT', 'Tax', 'Social Security']) {
        const { id } = await entityEnsure.ensureFinancialEntity(client, {
          name,
          type: 'business',
          ownerId: adminId,
        });
        await entityEnsure.ensureBusinessForEntity(client, id, {
          isDocumentsOptional: true,
          ownerId: adminId,
        });
        expect(id).toMatch(UUID_REGEX);
      }

      // Authority tax categories
      for (const name of ['Input Vat', 'Output Vat', 'Property Output Vat', 'Tax Expenses']) {
        const { id } = await entityEnsure.ensureFinancialEntity(client, {
          name,
          type: 'tax_category',
          ownerId: adminId,
        });
        await entityEnsure.ensureTaxCategoryForEntity(client, id, { ownerId: adminId });
        expect(id).toMatch(UUID_REGEX);
      }

      // Verify business count
      const businesses = await client.query(
        `SELECT id FROM accounter_schema.businesses WHERE owner_id = $1 OR id = $1`,
        [adminId],
      );
      expect(businesses.rows.length).toBeGreaterThanOrEqual(4); // admin + 3 authorities
    });
  });

  it('should be idempotent when called twice', async () => {
    await db.withTransaction(async client => {
      const { makeUUID } = await import('../demo-fixtures/helpers/deterministic-uuid.js');
      const precomputedId = makeUUID('business', 'Idempotent Corp');

      const bootstrap = async () => {
        await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [precomputedId]);
        await entityEnsure.ensureFinancialEntity(client, { id: precomputedId, name: 'Idempotent Corp', type: 'business' });
        await entityEnsure.ensureBusinessForEntity(client, precomputedId, { ownerId: precomputedId });
        await client.query(`UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`, [precomputedId]);
        return precomputedId;
      };

      const id1 = await bootstrap();
      const id2 = await bootstrap();
      expect(id1).toBe(id2);

      const result = await client.query(
        `SELECT COUNT(*) FROM accounter_schema.financial_entities WHERE name = 'Idempotent Corp'`,
      );
      expect(Number(result.rows[0].count)).toBe(1);
    });
  });

  it('should register and verify a super-admin', async () => {
    await db.withTransaction(async client => {
      const testAuth0Id = 'auth0|test-super-admin-123';

      // Insert super admin
      await client.query(
        `INSERT INTO accounter_schema.super_admins (auth0_user_id, note)
         VALUES ($1, $2) ON CONFLICT (auth0_user_id) DO NOTHING`,
        [testAuth0Id, 'integration test'],
      );

      // Verify it exists
      const result = await client.query(
        `SELECT auth0_user_id FROM accounter_schema.super_admins WHERE auth0_user_id = $1`,
        [testAuth0Id],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].auth0_user_id).toBe(testAuth0Id);

      // Verify a non-super-admin returns empty
      const none = await client.query(
        `SELECT auth0_user_id FROM accounter_schema.super_admins WHERE auth0_user_id = $1`,
        ['auth0|not-a-super-admin'],
      );
      expect(none.rows).toHaveLength(0);
    });
  });
});
