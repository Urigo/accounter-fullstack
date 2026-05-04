import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-04T12-00-00.update-scraper-ingestion-unique-constraints.sql',
  run: ({ sql }) => sql`
    -- Isracard deduplication key
    DROP INDEX IF EXISTS accounter_schema.isracard_creditcard_transactions_dedup_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS isracard_creditcard_transactions_dedup_uindex
      ON accounter_schema.isracard_creditcard_transactions (
        card,
        COALESCE(full_purchase_date, full_purchase_date_outbound, ''),
        COALESCE(full_payment_date, ''),
        COALESCE(payment_sum, payment_sum_outbound, 0),
        COALESCE(voucher_number, 0),
        COALESCE(supplier_id, 0),
        COALESCE(current_payment_currency, ''),
        COALESCE(full_supplier_name_heb, full_supplier_name_outbound, ''),
        COALESCE(more_info, '')
      );

    -- Amex deduplication key (identical shape to Isracard)
    DROP INDEX IF EXISTS accounter_schema.amex_creditcard_transactions_dedup_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS amex_creditcard_transactions_dedup_uindex
      ON accounter_schema.amex_creditcard_transactions (
        card,
        COALESCE(full_purchase_date, full_purchase_date_outbound, ''),
        COALESCE(full_payment_date, ''),
        COALESCE(payment_sum, payment_sum_outbound, 0),
        COALESCE(voucher_number, 0),
        COALESCE(supplier_id, 0),
        COALESCE(current_payment_currency, ''),
        COALESCE(full_supplier_name_heb, full_supplier_name_outbound, ''),
        COALESCE(more_info, '')
      );

    -- Max deduplication key
    DROP INDEX IF EXISTS accounter_schema.max_creditcard_transactions_uid_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS max_creditcard_transactions_uid_uindex
      ON accounter_schema.max_creditcard_transactions (uid, arn, purchase_date, payment_date, original_amount);
  `,
} satisfies MigrationExecutor;
