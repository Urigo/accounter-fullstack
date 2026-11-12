import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Deprecates `user_context.foreign_securities_business_id` and
 * `user_context.foreign_securities_fees_category_id`, superseded by `securities_context`
 * (`foreignSecuritiesBusinessId` and `taxCategories.foreignSecuritiesFees`) since
 * 2026-10-11T12-00-00.add-securities-context-to-user-context.
 *
 * From here on the server neither reads nor writes them. Postgres has no deprecation flag, so they
 * are marked with a column comment; the data stays, for a rollback, until a later migration drops
 * the columns.
 *
 * A value set in a legacy column since the first backfill (by a direct write, or before the server
 * mirrored legacy writes) is copied in once more first, without overwriting a key already set.
 */
export default {
  name: '2026-10-11T13-00-00.deprecate-legacy-foreign-securities-columns.sql',
  run: async ({ connection }) => {
    // The backfill runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.user_context NO FORCE ROW LEVEL SECURITY
    `);

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

    await connection.query(sql.unsafe`
      COMMENT ON COLUMN accounter_schema.user_context.foreign_securities_business_id IS
        'DEPRECATED: superseded by securities_context.foreignSecuritiesBusinessId. No longer read or written by the server; kept for rollback until it is dropped.'
    `);
    await connection.query(sql.unsafe`
      COMMENT ON COLUMN accounter_schema.user_context.foreign_securities_fees_category_id IS
        'DEPRECATED: superseded by securities_context.taxCategories.foreignSecuritiesFees. No longer read or written by the server; kept for rollback until it is dropped.'
    `);
  },
} satisfies MigrationExecutor;
