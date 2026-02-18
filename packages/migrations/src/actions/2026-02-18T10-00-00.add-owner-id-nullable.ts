import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-18T10-00-00.add-owner-id-nullable.sql',
  run: ({ sql }) => sql`
    -- Phase 1 of 4: Add owner_id column (Nullable)
    -- This prepares tables for Row-Level Security (RLS)
    -- Tables that already have owner_id are skipped:
    -- - charges, financial_entities, ledger_records, dividends, business_tax_category_match, dynamic_report_templates, user_context
    --
    -- Next phases:
    -- - Phase 2: Backfill owner_id (background job)
    -- - Phase 3: Make owner_id NOT NULL
    -- - Phase 4: Add indexes and foreign keys
    -- - Phase 5: Roll out RLS policies

    ALTER TABLE "accounter_schema"."business_trip_charges" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_attendees" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_employee_payments" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions_accommodations" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions_car_rental" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions_flights" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions_match" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions_other" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."business_trips_transactions_tns" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."businesses" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."businesses_admin" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."charge_balance_cancellation" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."charge_spread" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."charge_tags" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."charge_unbalanced_ledger_businesses" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."charges_bank_deposits" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."clients" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."clients_contracts" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."corporate_tax_variables" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."deel_invoices" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."deel_workers" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."depreciation" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."documents" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."documents_issued" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."employees" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."financial_accounts" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."financial_accounts_tax_categories" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."financial_bank_accounts" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."misc_expenses" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."pcn874" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."pension_funds" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."salaries" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."sort_codes" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."tags" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."tax_categories" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
    ALTER TABLE "accounter_schema"."transactions" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
  `,
} satisfies MigrationExecutor;
