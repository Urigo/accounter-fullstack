import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Multi-business read scope for the Otsar Hahayal raw tables.
 *
 * `2026-05-25T10-00-00.rls-multi-business-scope.sql` switched every
 * `tenant_isolation` read predicate to
 * `owner_id = ANY (accounter_schema.get_current_business_scope())`, leaving writes pinned to
 * the single `get_current_business_id()` target. The three Otsar Hahayal raw tables existed by
 * then (2026-05-18 / 05-24) but were not in its list, and no later migration picked them up —
 * they still read through the singular helper.
 *
 * The consequence is a silent narrowing rather than a leak: a request whose authorized scope
 * spans several businesses sees Otsar Hahayal raw rows for only the write-target business, with
 * nothing in the response saying so. `transactions` itself follows the scope, so any query that
 * joins a transaction to its raw row keeps the transaction and loses the row. Bank balances are
 * the sharp case: Otsar Hahayal states them only on the raw rows (`last_transaction_of_day` /
 * `closing_balance`, and the foreign-currency `balance`), so a balance read off the raw tables
 * drops out for every business in scope but one.
 *
 * This is the same gap, and the same fix, as
 * `2026-08-23T10-00-00.rls-scope-securities-tables.sql`; its header explains at length why
 * widening the permissive `USING` is not sufficient on its own. In short: `USING` also selects
 * the rows DELETE and UPDATE may act on, so once it spans the read scope, two RESTRICTIVE
 * per-command policies must keep those writes on the write target — otherwise a session could
 * delete another in-scope business's row, or update one into its own ownership. INSERT has no
 * `USING` and stays authorized by the permissive `WITH CHECK` alone.
 *
 * Scraper ingestion is unaffected. It only SELECTs its dedup candidates and INSERTs with
 * `ON CONFLICT DO NOTHING`, with `owner_id` set to the authenticated business — the write
 * target the `WITH CHECK` already required.
 */
export default {
  name: '2026-11-14T12-00-00.rls-scope-otsar-hahayal-tables.sql',
  run: async ({ connection }) => {
    const tables = [
      'otsar_hahayal_ils_account_transactions',
      'otsar_hahayal_foreign_account_transactions',
      'otsar_hahayal_creditcard_transactions',
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
      // target's ownership.
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
