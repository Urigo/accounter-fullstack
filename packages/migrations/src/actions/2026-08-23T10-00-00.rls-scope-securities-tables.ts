import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Multi-business read scope for the securities tables.
 *
 * `2026-05-25T10-00-00.rls-multi-business-scope.sql` switched every
 * `tenant_isolation` read predicate to
 * `owner_id = ANY (accounter_schema.get_current_business_scope())`, leaving writes pinned to
 * the single `get_current_business_id()` target. All four securities tables were created
 * *after* that migration (2026-08-11 / 08-13 / 08-20) and so were never in its list — they
 * still read through the singular helper.
 *
 * The consequence is a silent narrowing rather than a leak: a request whose authorized scope
 * spans several businesses sees securities for only one of them, with nothing in the response
 * saying so. That breaks the web client's business switcher and, more sharply, the MCP
 * connector, which forwards its resolved read scope as `x-business-scope` and echoes it back
 * to the caller (`docs/coherent-owner-scoping-for-mcp/plan.md`).
 *
 * Predicates are deliberately byte-identical to the earlier migration's: reads follow the
 * request's scope, writes stay on the explicit write target, so the scraper ingestion path is
 * unaffected.
 *
 * Widening the permissive `USING` is not sufficient on its own: **every write stays pinned to the
 * single write target, and only reads follow the scope.**
 *
 * `USING` is what selects the rows a statement may act on, and Postgres consults it for DELETE and
 * UPDATE as well as SELECT. `WITH CHECK` constrains only the *new* values an INSERT or UPDATE
 * writes. So a permissive policy whose `USING` spans the whole read scope would let a session
 * delete another in-scope business's row, or update one — the `WITH CHECK` would then happily
 * accept the result, since the new value names the write target, which is to say the row would be
 * *moved* from one business to another.
 *
 * Two RESTRICTIVE policies close that. A restrictive policy ANDs with the permissive one, so a row
 * must satisfy both: in the read scope (permissive) *and* owned by the write target (restrictive).
 * They are per-command on purpose — a restrictive `FOR ALL` would apply to SELECT too and undo the
 * widening this migration exists for. INSERT needs no such policy, having no `USING` at all; the
 * permissive `WITH CHECK` is the whole of its authorization.
 *
 * `2026-05-26T10-00-00.rls-delete-write-target.sql` established the DELETE half of this for the
 * tables it covered. The securities tables were not in its list either, and until now did not need
 * it because their `USING` was still the singular helper — widening the read scope is what creates
 * the need, so both halves belong in this migration.
 */
export default {
  name: '2026-08-23T10-00-00.rls-scope-securities-tables.sql',
  run: async ({ connection }) => {
    const tables = [
      'poalim_securities',
      'poalim_securities_transactions',
      'businesses_securities',
      'security_identifiers',
    ];

    for (const table of tables) {
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

      // Writes stay single-tenant. Both restrictive policies AND with the permissive one above,
      // so a row must be in the read scope *and* owned by the write target to be written.
      for (const command of ['delete', 'update'] as const) {
        await connection.query(
          sql.unsafe`DROP POLICY IF EXISTS ${sql.identifier([`tenant_isolation_${command}`])} ON accounter_schema.${sql.identifier([table])}`,
        );
      }

      // DELETE is authorized by USING alone.
      await connection.query(
        sql.unsafe`
          CREATE POLICY tenant_isolation_delete ON accounter_schema.${sql.identifier([table])}
          AS RESTRICTIVE
          FOR DELETE
          USING (owner_id = accounter_schema.get_current_business_id())
        `,
      );

      // UPDATE consults USING to pick the row and WITH CHECK to validate the new value. Without
      // this, a row owned by another business in the read scope could be updated into the write
      // target's ownership — a cross-tenant move that the permissive WITH CHECK would accept.
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
