import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-18T12-00-00.owner-id-not-null.sql',
  run: ({ sql }) => sql`
    -- Phase 3 of 4: Make owner_id NOT NULL
    -- This enforces that all rows must belong to a business (tenant isolation)
    -- Tables that must remain nullable (system owners):
    -- - financial_entities
    -- - ledger_records
    -- - user_context
    --
    -- Pre-requisite: Backfill job must have completed successfully (0 nulls)

    ALTER TABLE "accounter_schema"."business_trip_charges" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_attendees" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_employee_payments" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions_accommodations" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions_car_rental" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions_flights" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions_match" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions_other" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."business_trips_transactions_tns" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."businesses" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."businesses_admin" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."charge_balance_cancellation" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."charge_spread" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."charge_tags" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."charge_unbalanced_ledger_businesses" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."charges_bank_deposits" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."clients" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."clients_contracts" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."corporate_tax_variables" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."deel_invoices" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."deel_workers" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."depreciation" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."documents" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."documents_issued" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."employees" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."financial_accounts" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."financial_accounts_tax_categories" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."financial_bank_accounts" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."misc_expenses" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."pcn874" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."pension_funds" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."salaries" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."sort_codes" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."tags" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."tax_categories" ALTER COLUMN "owner_id" SET NOT NULL;
    ALTER TABLE "accounter_schema"."transactions" ALTER COLUMN "owner_id" SET NOT NULL;
  `,
} satisfies MigrationExecutor;
