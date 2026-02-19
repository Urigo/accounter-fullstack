import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-19T14-00-00.add-owner-id-indexes.sql',
  noTransaction: true,
  run: async ({ connection }) => {
    const tablesWithFk = [
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

    const tablesWithIndex = tablesWithFk.filter(
      t => !['dynamic_report_templates', 'user_context'].includes(t),
    );

    // Indexes
    for (const table of tablesWithIndex) {
      await connection.query(
        sql.unsafe`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${sql.identifier([
          `idx_${table}_owner_id`,
        ])} ON accounter_schema.${sql.identifier([table])}(owner_id)`,
      );
    }

    // Foreign Keys
    for (const table of tablesWithFk) {
      await connection.query(
        sql.unsafe`ALTER TABLE accounter_schema.${sql.identifier([table])} ADD CONSTRAINT ${sql.identifier(
          [`fk_${table}_owner_id`],
        )} FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
      );
    }

    // Validations
    for (const table of tablesWithFk) {
      await connection.query(
        sql.unsafe`ALTER TABLE accounter_schema.${sql.identifier([
          table,
        ])} VALIDATE CONSTRAINT ${sql.identifier([`fk_${table}_owner_id`])}`,
      );
    }
  },
} satisfies MigrationExecutor;
