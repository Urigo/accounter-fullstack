import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Cost refunds of an asset recorded in a foreign currency are entered in that currency:
 * `original_amount` / `original_currency` hold the refunded amount, and `disposed_cost` (local
 * currency) is left NULL, to be converted when read. Existing rows keep their `disposed_cost`.
 *
 * No data updates and no CHECK constraint: both run queries as the migration role, which hit the
 * forced row-level security on this table when that role isn't a superuser.
 */
export default {
  name: '2026-11-24T11-30-00.depreciation-disposal-original-amount.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.depreciation_disposals
      ADD COLUMN IF NOT EXISTS original_amount NUMERIC NULL,
      ADD COLUMN IF NOT EXISTS original_currency accounter_schema.currency NULL,
      ALTER COLUMN disposed_cost DROP NOT NULL;

    COMMENT ON COLUMN accounter_schema.depreciation_disposals.original_amount IS
      'A cost refund of an asset recorded in a foreign currency, in that currency (original_currency). disposed_cost is then NULL: the local cost is converted when read';
    COMMENT ON COLUMN accounter_schema.depreciation_disposals.original_currency IS
      'The currency of original_amount: the asset''s currency';
  `,
} satisfies MigrationExecutor;
