import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `depreciation.local_amount`: an optional cost basis in the local currency (ILS). An asset
 * paid for in a foreign currency is otherwise converted at the Bank of Israel rate of the purchase
 * charge's document date; when this is set, it wins.
 *
 * No CHECK constraint: validating one runs a query as the migration role, which hits the forced
 * row-level security on this table when that role isn't a superuser.
 */
export default {
  name: '2026-11-24T11-00-00.depreciation-local-amount.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.depreciation
      ADD COLUMN IF NOT EXISTS local_amount NUMERIC NULL;

    COMMENT ON COLUMN accounter_schema.depreciation.local_amount IS
      'Cost basis in the local currency (ILS). Overrides converting a foreign-currency amount at the purchase-date exchange rate; NULL computes it';
  `,
} satisfies MigrationExecutor;
