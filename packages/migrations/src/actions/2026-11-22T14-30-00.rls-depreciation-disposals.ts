import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Tenant isolation for `depreciation_disposals`, created after
 * `2026-05-12T09-00-00.enable-rls-all-tables.sql`. The policies are byte-identical to
 * `2026-09-28T10-30-00.rls-dynamic-report-comments.ts`; see there for the reasoning.
 */
export default {
  name: '2026-11-22T14-30-00.rls-depreciation-disposals.sql',
  run: async ({ connection }) => {
    for (const table of ['depreciation_disposals'] as const) {
      await connection.query(
        sql.unsafe`ALTER TABLE accounter_schema.${sql.identifier([table])} ENABLE ROW LEVEL SECURITY`,
      );

      await connection.query(
        sql.unsafe`ALTER TABLE accounter_schema.${sql.identifier([table])} FORCE ROW LEVEL SECURITY`,
      );

      await connection.query(
        sql.unsafe`DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.${sql.identifier([table])}`,
      );

      // Reads (USING): any business in the request's authorized scope.
      // Writes (WITH CHECK): strictly the single explicit write-target business.
      await connection.query(
        sql.unsafe`
          CREATE POLICY tenant_isolation ON accounter_schema.${sql.identifier([table])}
          FOR ALL
          USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
          WITH CHECK (owner_id = accounter_schema.get_current_business_id())
        `,
      );

      for (const command of ['delete', 'update'] as const) {
        await connection.query(
          sql.unsafe`DROP POLICY IF EXISTS ${sql.identifier([`tenant_isolation_${command}`])} ON accounter_schema.${sql.identifier([table])}`,
        );
      }

      await connection.query(
        sql.unsafe`
          CREATE POLICY tenant_isolation_delete ON accounter_schema.${sql.identifier([table])}
          AS RESTRICTIVE
          FOR DELETE
          USING (owner_id = accounter_schema.get_current_business_id())
        `,
      );

      await connection.query(
        sql.unsafe`
          CREATE POLICY tenant_isolation_update ON accounter_schema.${sql.identifier([table])}
          AS RESTRICTIVE
          FOR UPDATE
          USING (owner_id = accounter_schema.get_current_business_id())
        `,
      );
    }
  },
} satisfies MigrationExecutor;
