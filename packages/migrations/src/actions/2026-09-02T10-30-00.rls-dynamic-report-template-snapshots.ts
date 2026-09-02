import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Tenant isolation for `dynamic_report_template_snapshots`.
 *
 * The table is created after `2026-05-12T09-00-00.enable-rls-all-tables.sql` and the scoping
 * migrations that followed it, so it inherits none of them and would otherwise be readable and
 * writable across tenants. Predicates are deliberately byte-identical to
 * `2026-08-23T10-00-00.rls-scope-securities-tables.sql`: reads follow the request's authorized
 * scope, writes stay pinned to the single explicit write target.
 *
 * Widening the permissive USING is not sufficient on its own. Postgres consults USING for DELETE
 * and UPDATE as well as SELECT, while WITH CHECK constrains only the new value an INSERT or UPDATE
 * writes — so a permissive policy spanning the read scope would let a session delete another
 * in-scope business's snapshot, or update one into the write target's ownership. The two
 * RESTRICTIVE policies AND with the permissive one to close that, and are per-command on purpose:
 * a restrictive FOR ALL would apply to SELECT too and undo the widening. INSERT needs no such
 * policy, having no USING at all.
 *
 * ENABLE alone would not protect anything. `accounter_prod_user` inherits from `prod_group`, which
 * owns these tables, and a table owner is exempt from its own policies unless the table is FORCED —
 * so an enabled-but-unforced table looks protected in the catalog while filtering nothing for the
 * application. `2026-05-12T09-00-00.enable-rls-all-tables.sql` issues both for every table it
 * covers, and the invariant in `rls-all-tables.test.ts` asserts both for every table carrying an
 * `owner_id`.
 */
export default {
  name: '2026-09-02T10-30-00.rls-dynamic-report-template-snapshots.sql',
  run: async ({ connection }) => {
    const table = 'dynamic_report_template_snapshots';

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
  },
} satisfies MigrationExecutor;
