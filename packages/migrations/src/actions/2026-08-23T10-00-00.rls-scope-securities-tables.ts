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
    }
  },
} satisfies MigrationExecutor;
