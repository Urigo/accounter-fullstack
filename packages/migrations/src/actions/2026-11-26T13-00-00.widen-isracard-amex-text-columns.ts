import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * The Isracard and Amex raw tables were sized after the first accounts scraped into them:
 * supplier names capped at 15 or 20 characters, the city at 10, the currency at 4, and so
 * on. A longer value from another card holder fails the whole upload batch with "value too
 * long for type character varying(15)", one column at a time. These are values the issuer
 * sends, not ones this schema defines, so every length cap on the two tables goes. Changing
 * a varchar to text does not rewrite the table.
 */
export default {
  name: '2026-11-26T13-00-00.widen-isracard-amex-text-columns.sql',
  run: ({ sql }) => sql`
    DO $$
    DECLARE
      target RECORD;
    BEGIN
      FOR target IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'accounter_schema'
          AND table_name IN ('amex_creditcard_transactions', 'isracard_creditcard_transactions')
          AND data_type = 'character varying'
      LOOP
        EXECUTE format(
          'ALTER TABLE accounter_schema.%I ALTER COLUMN %I TYPE TEXT',
          target.table_name,
          target.column_name
        );
      END LOOP;
    END
    $$;
  `,
} satisfies MigrationExecutor;
