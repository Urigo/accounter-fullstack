import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Splits the securities withholding tax categories into local and foreign ones: the server now
 * books tax withheld on a dividend or a bond by the issuer's country, under
 * `taxCategories.{local,foreign}DividendWithholdingTax` and
 * `taxCategories.{local,foreign}BondWithholdingTax` of `user_context.securities_context`.
 *
 * The single `dividendWithholdingTax` and `bondWithholdingTax` set until now move to their foreign
 * key, without overwriting one already set; the local keys start unset. Only the configuration
 * changes — stored ledger records are left as they are, and regenerating a charge's ledger
 * suggests the new split for the user to review.
 */
export default {
  name: '2026-10-15T12-00-00.split-securities-withholding-tax-categories.sql',
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
        (securities_context -> 'taxCategories') - 'dividendWithholdingTax' - 'bondWithholdingTax'
          || CASE
               WHEN NOT (securities_context -> 'taxCategories') ? 'dividendWithholdingTax'
                 OR (securities_context -> 'taxCategories') ? 'foreignDividendWithholdingTax'
                 THEN '{}'::jsonb
               ELSE jsonb_build_object(
                 'foreignDividendWithholdingTax',
                 securities_context -> 'taxCategories' -> 'dividendWithholdingTax'
               )
             END
          || CASE
               WHEN NOT (securities_context -> 'taxCategories') ? 'bondWithholdingTax'
                 OR (securities_context -> 'taxCategories') ? 'foreignBondWithholdingTax'
                 THEN '{}'::jsonb
               ELSE jsonb_build_object(
                 'foreignBondWithholdingTax',
                 securities_context -> 'taxCategories' -> 'bondWithholdingTax'
               )
             END
      )
      WHERE jsonb_typeof(securities_context -> 'taxCategories') = 'object'
        AND (
          (securities_context -> 'taxCategories') ? 'dividendWithholdingTax'
          OR (securities_context -> 'taxCategories') ? 'bondWithholdingTax'
        )
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
