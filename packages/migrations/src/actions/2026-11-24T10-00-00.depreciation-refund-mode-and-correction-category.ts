import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * A supplier cost refund is a correction to the asset's cost, not a sale.
 *
 * - `depreciation_disposals.refund_mode` says how a `COST_REFUND` corrects the asset:
 *   `FROM_ACTIVATION` (the cost is reduced from activation; the depreciation booked on the refunded
 *   part in earlier years is reversed in the refund year) or `FROM_REFUND_DATE` (a later rebate: the
 *   cost drops on the refund date and only a refund above the book value gives income). NULL means
 *   `FROM_ACTIVATION`, so existing rows need no update. It is always NULL for sales and write-offs.
 * - A cost refund has no proceeds. Rows written before this migration stored the refunded cost in
 *   `proceeds`; the application ignores `proceeds` for refunds rather than rewriting those rows.
 * - `user_context.depreciation_correction_tax_category_id` is the ordinary-income account that the
 *   refund's income (the recapture or the excess over book value) is booked to.
 *
 * No rows are updated here, and the foreign key is declared inline on the new column: both
 * `depreciation_disposals` and `user_context` have forced RLS, and a migration has no business
 * context to satisfy their policies (an inline FK on a new, all-NULL column skips the validation
 * query that ADD CONSTRAINT would run).
 */
export default {
  name: '2026-11-24T10-00-00.depreciation-refund-mode-and-correction-category.sql',
  run: ({ sql }) => sql`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'depreciation_refund_mode' AND n.nspname = 'accounter_schema') THEN
    CREATE TYPE accounter_schema.depreciation_refund_mode AS ENUM ('FROM_ACTIVATION', 'FROM_REFUND_DATE');
  END IF;
END $$;

ALTER TABLE accounter_schema.depreciation_disposals
    ADD COLUMN IF NOT EXISTS refund_mode accounter_schema.depreciation_refund_mode NULL;

COMMENT ON COLUMN accounter_schema.depreciation_disposals.refund_mode IS
  'COST_REFUND only: how the refund corrects the asset cost. NULL means FROM_ACTIVATION';
COMMENT ON COLUMN accounter_schema.depreciation_disposals.disposed_cost IS
  'Local currency, excluding VAT: the part of the asset cost that leaves the books (sale, write-off), or the refunded amount that reduces the cost (cost refund)';
COMMENT ON COLUMN accounter_schema.depreciation_disposals.proceeds IS
  'Consideration for a sale, local currency, excluding VAT. 0 for a write-off; a cost refund has no proceeds (ignored for refunds stored before refund modes existed)';

ALTER TABLE accounter_schema.user_context
    ADD COLUMN IF NOT EXISTS depreciation_correction_tax_category_id uuid NULL
        CONSTRAINT user_context_tax_categories_id_fk_42
            REFERENCES accounter_schema.tax_categories (id);
`,
} satisfies MigrationExecutor;
