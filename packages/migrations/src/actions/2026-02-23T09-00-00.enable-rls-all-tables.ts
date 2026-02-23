import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-23T09-00-00.enable-rls-all-tables.sql',
  noTransaction: true,
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
    ];

    for (const table of tables) {
      // 1. Enable RLS
      await connection.query(
        sql.unsafe`ALTER TABLE accounter_schema.${sql.identifier([table])} ENABLE ROW LEVEL SECURITY`,
      );

      // 2. Force RLS
      await connection.query(
        sql.unsafe`ALTER TABLE accounter_schema.${sql.identifier([table])} FORCE ROW LEVEL SECURITY`,
      );

      // 3. Drop existing policy if any
      await connection.query(
        sql.unsafe`DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.${sql.identifier([table])}`,
      );

      // 4. Create Policy
      // Note: We use sql.unsafe for the creation string because Slonik identifier binding
      // works for the target object name in ON clause but not inside the policy body.
      // The condition string is static and trusted.
      await connection.query(
        sql.unsafe`
          CREATE POLICY tenant_isolation ON accounter_schema.${sql.identifier([table])}
          FOR ALL
          USING (owner_id = accounter_schema.get_current_business_id())
          WITH CHECK (owner_id = accounter_schema.get_current_business_id())
        `,
      );
    }
  },
} satisfies MigrationExecutor;
