import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-19T14-00-00.add-owner-id-indexes.sql',
  noTransaction: true,
  run: async ({ sql, connection }) => {
    // Indexes
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trip_charges_owner_id ON accounter_schema.business_trip_charges(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_charge_balance_cancellation_owner_id ON accounter_schema.charge_balance_cancellation(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_charge_spread_owner_id ON accounter_schema.charge_spread(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_charge_tags_owner_id ON accounter_schema.charge_tags(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_charge_unbalanced_ledger_businesses_owner_id ON accounter_schema.charge_unbalanced_ledger_businesses(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_charges_bank_deposits_owner_id ON accounter_schema.charges_bank_deposits(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_depreciation_owner_id ON accounter_schema.depreciation(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_owner_id ON accounter_schema.documents(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_misc_expenses_owner_id ON accounter_schema.misc_expenses(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_owner_id ON accounter_schema.transactions(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_owner_id ON accounter_schema.businesses(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_admin_owner_id ON accounter_schema.businesses_admin(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corporate_tax_variables_owner_id ON accounter_schema.corporate_tax_variables(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_owner_id ON accounter_schema.employees(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salaries_owner_id ON accounter_schema.salaries(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pcn874_owner_id ON accounter_schema.pcn874(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_owner_id ON accounter_schema.clients(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deel_workers_owner_id ON accounter_schema.deel_workers(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_issued_owner_id ON accounter_schema.documents_issued(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deel_invoices_owner_id ON accounter_schema.deel_invoices(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_accounts_owner_id ON accounter_schema.financial_accounts(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_accounts_tax_categories_owner_id ON accounter_schema.financial_accounts_tax_categories(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_bank_accounts_owner_id ON accounter_schema.financial_bank_accounts(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_owner_id ON accounter_schema.business_trips(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_attendees_owner_id ON accounter_schema.business_trips_attendees(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_owner_id ON accounter_schema.business_trips_transactions(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_employee_payments_owner_id ON accounter_schema.business_trips_employee_payments(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_accommodations_owner_id ON accounter_schema.business_trips_transactions_accommodations(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_car_rental_owner_id ON accounter_schema.business_trips_transactions_car_rental(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_flights_owner_id ON accounter_schema.business_trips_transactions_flights(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_match_owner_id ON accounter_schema.business_trips_transactions_match(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_other_owner_id ON accounter_schema.business_trips_transactions_other(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_trips_transactions_tns_owner_id ON accounter_schema.business_trips_transactions_tns(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tax_categories_owner_id ON accounter_schema.tax_categories(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_contracts_owner_id ON accounter_schema.clients_contracts(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pension_funds_owner_id ON accounter_schema.pension_funds(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sort_codes_owner_id ON accounter_schema.sort_codes(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_owner_id ON accounter_schema.tags(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_charges_owner_id ON accounter_schema.charges(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_entities_owner_id ON accounter_schema.financial_entities(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_records_owner_id ON accounter_schema.ledger_records(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_tax_category_match_owner_id ON accounter_schema.business_tax_category_match(owner_id)`,
    );
    await connection.query(
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dividends_owner_id ON accounter_schema.dividends(owner_id)`,
    );

    // Foreign Keys
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trip_charges ADD CONSTRAINT fk_business_trip_charges_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_balance_cancellation ADD CONSTRAINT fk_charge_balance_cancellation_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_spread ADD CONSTRAINT fk_charge_spread_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_tags ADD CONSTRAINT fk_charge_tags_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_unbalanced_ledger_businesses ADD CONSTRAINT fk_charge_unbalanced_ledger_businesses_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charges_bank_deposits ADD CONSTRAINT fk_charges_bank_deposits_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.depreciation ADD CONSTRAINT fk_depreciation_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.documents ADD CONSTRAINT fk_documents_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.misc_expenses ADD CONSTRAINT fk_misc_expenses_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.transactions ADD CONSTRAINT fk_transactions_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.businesses ADD CONSTRAINT fk_businesses_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.businesses_admin ADD CONSTRAINT fk_businesses_admin_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.corporate_tax_variables ADD CONSTRAINT fk_corporate_tax_variables_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.employees ADD CONSTRAINT fk_employees_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.salaries ADD CONSTRAINT fk_salaries_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.pcn874 ADD CONSTRAINT fk_pcn874_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.clients ADD CONSTRAINT fk_clients_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.deel_workers ADD CONSTRAINT fk_deel_workers_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.documents_issued ADD CONSTRAINT fk_documents_issued_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.deel_invoices ADD CONSTRAINT fk_deel_invoices_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_accounts ADD CONSTRAINT fk_financial_accounts_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_accounts_tax_categories ADD CONSTRAINT fk_financial_accounts_tax_categories_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_bank_accounts ADD CONSTRAINT fk_financial_bank_accounts_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips ADD CONSTRAINT fk_business_trips_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_attendees ADD CONSTRAINT fk_business_trips_attendees_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions ADD CONSTRAINT fk_business_trips_transactions_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_employee_payments ADD CONSTRAINT fk_business_trips_employee_payments_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_accommodations ADD CONSTRAINT fk_business_trips_transactions_accommodations_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_car_rental ADD CONSTRAINT fk_business_trips_transactions_car_rental_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_flights ADD CONSTRAINT fk_business_trips_transactions_flights_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_match ADD CONSTRAINT fk_business_trips_transactions_match_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_other ADD CONSTRAINT fk_business_trips_transactions_other_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_tns ADD CONSTRAINT fk_business_trips_transactions_tns_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.tax_categories ADD CONSTRAINT fk_tax_categories_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.clients_contracts ADD CONSTRAINT fk_clients_contracts_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.pension_funds ADD CONSTRAINT fk_pension_funds_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.sort_codes ADD CONSTRAINT fk_sort_codes_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.tags ADD CONSTRAINT fk_tags_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charges ADD CONSTRAINT fk_charges_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_entities ADD CONSTRAINT fk_financial_entities_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.ledger_records ADD CONSTRAINT fk_ledger_records_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_tax_category_match ADD CONSTRAINT fk_business_tax_category_match_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.dividends ADD CONSTRAINT fk_dividends_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.dynamic_report_templates ADD CONSTRAINT fk_dynamic_report_templates_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.user_context ADD CONSTRAINT fk_user_context_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID`,
    );

    // Validations
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trip_charges VALIDATE CONSTRAINT fk_business_trip_charges_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_balance_cancellation VALIDATE CONSTRAINT fk_charge_balance_cancellation_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_spread VALIDATE CONSTRAINT fk_charge_spread_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_tags VALIDATE CONSTRAINT fk_charge_tags_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charge_unbalanced_ledger_businesses VALIDATE CONSTRAINT fk_charge_unbalanced_ledger_businesses_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charges_bank_deposits VALIDATE CONSTRAINT fk_charges_bank_deposits_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.depreciation VALIDATE CONSTRAINT fk_depreciation_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.documents VALIDATE CONSTRAINT fk_documents_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.misc_expenses VALIDATE CONSTRAINT fk_misc_expenses_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.transactions VALIDATE CONSTRAINT fk_transactions_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.businesses VALIDATE CONSTRAINT fk_businesses_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.businesses_admin VALIDATE CONSTRAINT fk_businesses_admin_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.corporate_tax_variables VALIDATE CONSTRAINT fk_corporate_tax_variables_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.employees VALIDATE CONSTRAINT fk_employees_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.salaries VALIDATE CONSTRAINT fk_salaries_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.pcn874 VALIDATE CONSTRAINT fk_pcn874_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.clients VALIDATE CONSTRAINT fk_clients_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.deel_workers VALIDATE CONSTRAINT fk_deel_workers_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.documents_issued VALIDATE CONSTRAINT fk_documents_issued_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.deel_invoices VALIDATE CONSTRAINT fk_deel_invoices_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_accounts VALIDATE CONSTRAINT fk_financial_accounts_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_accounts_tax_categories VALIDATE CONSTRAINT fk_financial_accounts_tax_categories_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_bank_accounts VALIDATE CONSTRAINT fk_financial_bank_accounts_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips VALIDATE CONSTRAINT fk_business_trips_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_attendees VALIDATE CONSTRAINT fk_business_trips_attendees_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions VALIDATE CONSTRAINT fk_business_trips_transactions_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_employee_payments VALIDATE CONSTRAINT fk_business_trips_employee_payments_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_accommodations VALIDATE CONSTRAINT fk_business_trips_transactions_accommodations_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_car_rental VALIDATE CONSTRAINT fk_business_trips_transactions_car_rental_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_flights VALIDATE CONSTRAINT fk_business_trips_transactions_flights_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_match VALIDATE CONSTRAINT fk_business_trips_transactions_match_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_other VALIDATE CONSTRAINT fk_business_trips_transactions_other_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_trips_transactions_tns VALIDATE CONSTRAINT fk_business_trips_transactions_tns_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.tax_categories VALIDATE CONSTRAINT fk_tax_categories_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.clients_contracts VALIDATE CONSTRAINT fk_clients_contracts_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.pension_funds VALIDATE CONSTRAINT fk_pension_funds_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.sort_codes VALIDATE CONSTRAINT fk_sort_codes_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.tags VALIDATE CONSTRAINT fk_tags_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.charges VALIDATE CONSTRAINT fk_charges_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.financial_entities VALIDATE CONSTRAINT fk_financial_entities_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.ledger_records VALIDATE CONSTRAINT fk_ledger_records_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.business_tax_category_match VALIDATE CONSTRAINT fk_business_tax_category_match_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.dividends VALIDATE CONSTRAINT fk_dividends_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.dynamic_report_templates VALIDATE CONSTRAINT fk_dynamic_report_templates_owner_id`,
    );
    await connection.query(
      sql`ALTER TABLE accounter_schema.user_context VALIDATE CONSTRAINT fk_user_context_owner_id`,
    );
  },
} satisfies MigrationExecutor;
