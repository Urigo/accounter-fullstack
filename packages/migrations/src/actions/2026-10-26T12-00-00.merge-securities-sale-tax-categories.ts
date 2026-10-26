import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Merges the securities sale tax categories of `user_context.securities_context`: the server now
 * books a sale's or redemption's price gain or loss to one category, and its exchange-rate gain or
 * loss to another.
 *
 * - `taxCategories.foreignSecuritiesSaleLoss` folds into `foreignSecuritiesSaleGain`;
 * - `taxCategories.foreignSecuritiesSaleExchangeGain` and `foreignSecuritiesSaleExchangeLoss` fold
 *   into the new `foreignSecuritiesExchangeRate`, the gain one first.
 *
 * A key already set is not overwritten, and the folded keys are dropped. Only the configuration
 * changes — stored ledger records are left as they are, and regenerating a charge's ledger books it
 * to the merged categories.
 */
export default {
  name: '2026-10-26T12-00-00.merge-securities-sale-tax-categories.sql',
  run: async ({ connection }) => {
    // The update runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context NO FORCE ROW LEVEL SECURITY
    `);

    await connection.query(sql.unsafe`
      UPDATE accounter_schema.user_context
      SET securities_context = jsonb_set(
        securities_context,
        '{taxCategories}',
        jsonb_strip_nulls(
          jsonb_build_object(
            'foreignSecuritiesSaleGain',
            securities_context -> 'taxCategories' -> 'foreignSecuritiesSaleLoss',
            'foreignSecuritiesExchangeRate',
            COALESCE(
              securities_context -> 'taxCategories' -> 'foreignSecuritiesSaleExchangeGain',
              securities_context -> 'taxCategories' -> 'foreignSecuritiesSaleExchangeLoss'
            )
          )
        )
          || (securities_context -> 'taxCategories')
            - 'foreignSecuritiesSaleLoss'
            - 'foreignSecuritiesSaleExchangeGain'
            - 'foreignSecuritiesSaleExchangeLoss'
      )
      WHERE jsonb_typeof(securities_context -> 'taxCategories') = 'object'
        AND (
          (securities_context -> 'taxCategories') ? 'foreignSecuritiesSaleLoss'
          OR (securities_context -> 'taxCategories') ? 'foreignSecuritiesSaleExchangeGain'
          OR (securities_context -> 'taxCategories') ? 'foreignSecuritiesSaleExchangeLoss'
        )
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
