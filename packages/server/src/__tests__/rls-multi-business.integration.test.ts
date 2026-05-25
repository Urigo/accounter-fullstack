import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase } from './helpers/db-setup.js';

/**
 * Verifies the multi-business RLS migration:
 * - `get_current_business_scope()` parses the `app.current_business_scope`
 *   array setting and falls back to the single business context when unset.
 * - tenant_isolation policies read via the scope array (USING) while writes
 *   stay pinned to the single business (WITH CHECK).
 *
 * Note: the test DB connects as a superuser, which bypasses RLS row filtering,
 * so this asserts the helper behavior and the policy definitions (via
 * pg_policies) rather than cross-connection row visibility.
 */
describe('multi-business RLS scope', () => {
  let db: TestDatabase;

  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
  });

  afterAll(async () => {
    // Pool managed by global vitest setup — do not close here.
  });

  it('parses the business scope array setting', async () => {
    await db.withTransaction(async client => {
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [A]);
      await client.query(`SELECT set_config('app.current_business_scope', $1, true)`, [
        `{${A},${B}}`,
      ]);

      const res = await client.query(
        `SELECT accounter_schema.get_current_business_scope() AS scope`,
      );
      expect(res.rows[0].scope).toEqual([A, B]);
    });
  });

  it('falls back to the single business context when scope is unset', async () => {
    await db.withTransaction(async client => {
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [A]);
      await client.query(`SELECT set_config('app.current_business_scope', '', true)`);

      const res = await client.query(
        `SELECT accounter_schema.get_current_business_scope() AS scope`,
      );
      expect(res.rows[0].scope).toEqual([A]);
    });
  });

  it('uses the scope array for reads and the single business for writes', async () => {
    await db.withTransaction(async client => {
      const res = await client.query(
        `SELECT qual, with_check
         FROM pg_policies
         WHERE schemaname = 'accounter_schema'
           AND tablename = 'charges'
           AND policyname = 'tenant_isolation'`,
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].qual).toContain('get_current_business_scope');
      expect(res.rows[0].with_check).toContain('get_current_business_id');
    });
  });
});
