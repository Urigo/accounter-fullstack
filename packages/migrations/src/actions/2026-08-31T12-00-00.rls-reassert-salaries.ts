import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Re-assert RLS on `accounter_schema.salaries`.
 *
 * `salaries` is listed in all three of the RLS migrations that built the current
 * tenant-isolation setup — `2026-05-12T09-00-00.enable-rls-all-tables.sql`
 * (ENABLE + FORCE + policy), `2026-05-25T10-00-00.rls-multi-business-scope.sql`
 * (the multi-business read predicate) and
 * `2026-05-26T10-00-00.rls-delete-write-target.sql` (the restrictive DELETE
 * policy) — so a database built from this repo's migration history already has
 * the table enabled, forced and policied. That was verified by running the full
 * migration set into an empty database.
 *
 * A production catalog snapshot nevertheless reported `salaries` as the one
 * `owner_id`-carrying table in `accounter_schema` with RLS off. Nothing in the
 * repo turns it off: no migration issues `DISABLE`/`NO FORCE` against it, and no
 * application, seed or script path does either. The remaining explanation is
 * catalog drift on that server — `relrowsecurity` / `relforcerowsecurity` are
 * per-table flags that a manual `ALTER TABLE`, or a restore that replayed DDL
 * without them, can clear while leaving the policy objects intact. Policies that
 * exist on a table with RLS disabled are inert, which matches the reported
 * symptom exactly: a policy is present, and no row is ever filtered.
 *
 * So this migration is a re-assertion, not a first-time enable. Every statement
 * is idempotent: against a database built from the migration history it is a
 * no-op, and against a drifted one it restores the intended state. The policy
 * predicates are byte-identical to the two migrations that own them, so this
 * cannot silently redefine tenant scoping — `DROP POLICY IF EXISTS` followed by
 * an identical `CREATE POLICY` is how the existing migrations already re-state
 * these.
 *
 * `FORCE` is load-bearing and not optional: `accounter_prod_user` inherits from
 * `prod_group`, which owns these tables, and a table owner is exempt from its own
 * policies unless the table is forced. `ENABLE` alone would leave the application
 * role reading every tenant's rows.
 *
 * `owner_id` on this table is already `NOT NULL` (set by
 * `2026-02-18T16-00-00.owner-id-not-null.sql`), so there is no row that enabling
 * the policy could strand: a NULL `owner_id` would match neither predicate and
 * would vanish from the application's view. No constraint is added here because
 * the column already carries one.
 *
 * Plain DDL, so it runs in the default per-migration transaction.
 */
export default {
  name: '2026-08-31T12-00-00.rls-reassert-salaries.sql',
  run: async ({ connection }) => {
    // Both are no-ops when the flags are already set.
    await connection.query(
      sql.unsafe`ALTER TABLE accounter_schema.salaries ENABLE ROW LEVEL SECURITY`,
    );
    await connection.query(
      sql.unsafe`ALTER TABLE accounter_schema.salaries FORCE ROW LEVEL SECURITY`,
    );

    // Reads (USING): any business in the request's authorized scope.
    // Writes (WITH CHECK): strictly the single explicit write-target business.
    // Identical to 2026-05-25T10-00-00.rls-multi-business-scope.sql.
    await connection.query(
      sql.unsafe`DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.salaries`,
    );
    await connection.query(sql.unsafe`
      CREATE POLICY tenant_isolation ON accounter_schema.salaries
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id())
    `);

    // DELETE consults only USING, so the permissive policy above would otherwise
    // let a session delete any in-scope business's row. Identical to
    // 2026-05-26T10-00-00.rls-delete-write-target.sql.
    await connection.query(
      sql.unsafe`DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.salaries`,
    );
    await connection.query(sql.unsafe`
      CREATE POLICY tenant_isolation_delete ON accounter_schema.salaries
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id())
    `);
  },
} satisfies MigrationExecutor;
