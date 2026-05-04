import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-04-29T12-00-00.add-scraper-ingestion-unique-constraints.sql',
  run: ({ sql }) => sql`
    -- Poalim ILS deduplication key
    CREATE UNIQUE INDEX IF NOT EXISTS poalim_ils_account_transactions_dedup_uindex
      ON accounter_schema.poalim_ils_account_transactions
      (event_date, serial_number, reference_number, account_number, branch_number);

    -- Poalim Foreign deduplication key
    CREATE UNIQUE INDEX IF NOT EXISTS poalim_foreign_account_transactions_dedup_uindex
      ON accounter_schema.poalim_foreign_account_transactions
      (executing_date, reference_number, account_number, branch_number);

    -- Poalim Swift deduplication key
    CREATE UNIQUE INDEX IF NOT EXISTS poalim_swift_account_transactions_transfer_id_uindex
      ON accounter_schema.poalim_swift_account_transactions (transfer_catenated_id)
      WHERE transfer_catenated_id IS NOT NULL;

    -- Isracard deduplication key
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
      )
      WHERE COALESCE(full_purchase_date, full_purchase_date_outbound) IS NOT NULL
        AND COALESCE(payment_sum, payment_sum_outbound) IS NOT NULL
        AND voucher_number IS NOT NULL
        AND COALESCE(voucher_number_ratz, voucher_number_ratz_outbound) IS NOT NULL;

    -- Amex deduplication key (identical shape to Isracard)
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
      )
      WHERE COALESCE(full_purchase_date, full_purchase_date_outbound) IS NOT NULL
        AND COALESCE(payment_sum, payment_sum_outbound) IS NOT NULL
        AND voucher_number IS NOT NULL
        AND COALESCE(voucher_number_ratz, voucher_number_ratz_outbound) IS NOT NULL;

    -- Max deduplication key
    CREATE UNIQUE INDEX IF NOT EXISTS max_creditcard_transactions_uid_uindex
      ON accounter_schema.max_creditcard_transactions (uid, arn, purchase_date, payment_date, original_amount);

    -- Discount: widen existing urn-only constraint to (urn, account_number)
    ALTER TABLE accounter_schema.bank_discount_transactions
      DROP CONSTRAINT IF EXISTS bank_discount_transactions_urn_idx;

    CREATE UNIQUE INDEX IF NOT EXISTS bank_discount_transactions_urn_account_uindex
      ON accounter_schema.bank_discount_transactions (urn, account_number)
      WHERE urn IS NOT NULL AND account_number IS NOT NULL;
  `,
} satisfies MigrationExecutor;
