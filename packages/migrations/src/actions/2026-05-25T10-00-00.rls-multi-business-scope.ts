import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Multi-business read scope for RLS.
 *
 * Adds `get_current_business_scope()` (the request's authorized read scope as a
 * UUID array) and switches every tenant_isolation read predicate (USING) to
 * `owner_id = ANY (get_current_business_scope())`, while writes (WITH CHECK)
 * stay pinned to the single `get_current_business_id()` target.
 *
 * The scope helper falls back to `ARRAY[get_current_business_id()]` when
 * `app.current_business_scope` is unset, so this migration is backward
 * compatible: until the tenant DB client sets the scope (a later step), reads
 * behave exactly as before.
 *
 * The separate `allow_bootstrap_root` (businesses / financial_entities) and
 * `super_admins_select` policies are intentionally left untouched.
 */
export default {
  name: '2026-05-25T10-00-00.rls-multi-business-scope.sql',
  run: async ({ connection }) => {
    await connection.query(sql.unsafe`
      CREATE OR REPLACE FUNCTION accounter_schema.get_current_business_scope()
      RETURNS UUID[]
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog
      AS $$
      DECLARE
        v_scope_text TEXT;
      BEGIN
        -- Read scope is serialized as a Postgres array literal, e.g. '{uuid1,uuid2}'.
        v_scope_text := NULLIF(current_setting('app.current_business_scope', true), '');

        -- Fallback to the single business context while the scope is not yet set,
        -- preserving pre-multi-business read behavior.
        IF v_scope_text IS NULL THEN
          RETURN ARRAY[accounter_schema.get_current_business_id()];
        END IF;

        RETURN v_scope_text::uuid[];
      END;
      $$;
    `);

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
