import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-06T14-00-00.update-scraper-ingestion-poalim-unique-constraints.sql',
  run: ({ sql }) => sql`  
    -- Poalim ILS deduplication key
    DROP INDEX IF EXISTS accounter_schema.poalim_ils_account_transactions_dedup_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS poalim_ils_account_transactions_dedup_uindex
          ON accounter_schema.poalim_ils_account_transactions
          (event_date, serial_number, account_number, branch_number) NULLS NOT DISTINCT;

    -- Poalim Foreign deduplication key
    DROP INDEX IF EXISTS accounter_schema.poalim_foreign_account_transactions_dedup_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS poalim_foreign_account_transactions_dedup_uindex
      ON accounter_schema.poalim_foreign_account_transactions
      (executing_date, account_number, branch_number, event_number) NULLS NOT DISTINCT;


    -- Poalim Swift deduplication key
    DROP INDEX IF EXISTS accounter_schema.poalim_swift_account_transactions_transfer_id_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS poalim_swift_account_transactions_transfer_id_uindex
      ON accounter_schema.poalim_swift_account_transactions (transfer_catenated_id) NULLS NOT DISTINCT;
  `,
} satisfies MigrationExecutor;
