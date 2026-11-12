import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * The tenant's securities ledger configuration: the general foreign-securities business, the tax
 * categories that securities fees, dividends, bond interest, withheld tax and redemption
 * gains/losses are booked to, plus the sort code new securities tax categories are created under.
 * Every field is optional; the server parses it leniently.
 *
 * Shape (camelCase keys):
 *   {
 *     "foreignSecuritiesBusinessId": "<uuid>",
 *     "sortCode": 990,
 *     "taxCategories": { "foreignSecuritiesFees": "<uuid>", "foreignDividendIncome": "<uuid>", ... }
 *   }
 *
 * It supersedes the legacy `foreign_securities_business_id` and
 * `foreign_securities_fees_category_id` columns, whose values are copied in here. The columns stay
 * until a following migration deprecates them.
 */
export default {
  name: '2026-10-11T12-00-00.add-securities-context-to-user-context.sql',
  run: async ({ connection }) => {
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context
        ADD COLUMN IF NOT EXISTS securities_context JSONB NOT NULL DEFAULT '{}'::jsonb
        CONSTRAINT user_context_securities_context_is_object
          CHECK (jsonb_typeof(securities_context) = 'object')
    `);

    // The backfill runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context NO FORCE ROW LEVEL SECURITY
    `);

    // Auto-fill from the legacy columns, without overwriting a key already set.
    await connection.query(sql.unsafe`
      UPDATE accounter_schema.user_context
      SET securities_context = securities_context
        || CASE
             WHEN foreign_securities_business_id IS NULL
               OR securities_context ? 'foreignSecuritiesBusinessId' THEN '{}'::jsonb
             ELSE jsonb_build_object('foreignSecuritiesBusinessId', foreign_securities_business_id)
           END
        || CASE
             WHEN foreign_securities_fees_category_id IS NULL
               OR COALESCE(securities_context -> 'taxCategories', '{}'::jsonb) ? 'foreignSecuritiesFees'
               THEN '{}'::jsonb
             ELSE jsonb_build_object(
               'taxCategories',
               COALESCE(securities_context -> 'taxCategories', '{}'::jsonb)
                 || jsonb_build_object('foreignSecuritiesFees', foreign_securities_fees_category_id)
             )
           END
      WHERE foreign_securities_business_id IS NOT NULL
         OR foreign_securities_fees_category_id IS NOT NULL
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
