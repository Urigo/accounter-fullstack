import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Pin DELETE operations to the single write-target business.
 *
 * The previous migration (rls-multi-business-scope) replaced the read-side
 * USING predicate with `owner_id = ANY(get_current_business_scope())`.
 * PostgreSQL's DELETE command uses only USING (not WITH CHECK), so that change
 * inadvertently widened the delete envelope to every business in the read
 * scope — not just the explicit write target.
 *
 * This migration adds an AS RESTRICTIVE policy for DELETE on every
 * tenant-isolated table. A RESTRICTIVE policy ANDs with permissive ones, so a
 * DELETE row must satisfy BOTH the permissive USING (in scope) AND this
 * restriction (= write target). Net effect: only rows owned by the current
 * write-target business can be deleted — the same guarantee that existed before
 * the multi-business read scope was introduced.
 */
export default {
  name: '2026-05-26T10-00-00.rls-delete-write-target.sql',
  run: async ({ connection }) => {
    const tables = [
      'business_tax_category_match',
      'business_trip_charges',
      'business_trips',
      'business_trips_attendees',
      'business_trips_employee_payments',
      'business_trips_transactions',
      'business_trips_transactions_accommodations',
      'business_trips_transactions_car_rental',
      'business_trips_transactions_flights',
      'business_trips_transactions_match',
      'business_trips_transactions_other',
      'business_trips_transactions_tns',
      'businesses',
      'businesses_admin',
      'charge_balance_cancellation',
      'charge_spread',
      'charge_tags',
      'charge_unbalanced_ledger_businesses',
      'charges',
      'charges_bank_deposits',
      'clients',
      'clients_contracts',
      'corporate_tax_variables',
      'deel_invoices',
      'deel_workers',
      'depreciation',
      'dividends',
      'documents',
      'documents_issued',
      'dynamic_report_templates',
      'employees',
      'financial_accounts',
      'financial_accounts_tax_categories',
      'financial_bank_accounts',
      'financial_entities',
      'ledger_records',
      'misc_expenses',
      'pcn874',
      'pension_funds',
      'salaries',
      'sort_codes',
      'tags',
      'tax_categories',
      'transactions',
      'user_context',
      'annual_audit_step_status',
    ];

    for (const table of tables) {
      await connection.query(
        sql.unsafe`DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.${sql.identifier([table])}`,
      );

      // A RESTRICTIVE policy ANDs with all permissive policies. For DELETE,
      // Postgres evaluates only USING — WITH CHECK is ignored. This restriction
      // ensures that even when the read scope spans multiple businesses, only
      // rows owned by the current write-target business can be deleted.
      await connection.query(
        sql.unsafe`
          CREATE POLICY tenant_isolation_delete ON accounter_schema.${sql.identifier([table])}
          AS RESTRICTIVE
          FOR DELETE
          USING (owner_id = accounter_schema.get_current_business_id())
        `,
      );
    }
  },
} satisfies MigrationExecutor;
