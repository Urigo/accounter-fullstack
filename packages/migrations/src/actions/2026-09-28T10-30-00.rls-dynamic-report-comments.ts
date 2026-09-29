import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Tenant isolation for `dynamic_report_threads` and `dynamic_report_comments`.
 *
 * Both tables are created after `2026-05-12T09-00-00.enable-rls-all-tables.sql`, so they inherit
 * none of it. The policies are byte-identical to
 * `2026-09-02T10-30-00.rls-dynamic-report-template-snapshots.ts`, and the reasoning is the same:
 *
 * - The permissive `tenant_isolation` policy lets reads follow the request's authorized scope and
 *   pins writes to the single explicit write target.
 * - Postgres consults USING for DELETE and UPDATE as well as SELECT, so the two RESTRICTIVE
 *   per-command policies stop a session from deleting another in-scope business's rows, or
 *   updating them into the write target's ownership. They are per-command, because a restrictive
 *   FOR ALL would narrow SELECT too.
 * - FORCE is what makes the policies apply to the application at all: its role inherits
 *   ownership of these tables, and a table owner is exempt from an unforced policy.
 *   `rls-all-tables.test.ts` asserts both flags for every table carrying an `owner_id`.
 */
export default {
  name: '2026-09-28T10-30-00.rls-dynamic-report-comments.sql',
  run: async ({ connection }) => {
    for (const table of ['dynamic_report_threads', 'dynamic_report_comments'] as const) {
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
