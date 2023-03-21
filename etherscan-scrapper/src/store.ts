import { diary } from 'diary';
import createPgp from 'pg-promise';
import type { NormalizedEtherscanTransaction } from './etherscan.js';

const logger = diary('store');

export async function createAndConnectStore(options: { connectionString: string; schema: string }) {
  const tableName = `etherscan_transactions`;

  logger.info(`Creating database instance...`);
  const pgp = createPgp();
  const pg = pgp({
    connectionString: options.connectionString,
    allowExitOnIdle: true,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  logger.info(`Connecting to database...`);
  await pg.connect();
  logger.info(`Database is now connected!`);

  return {
    async close() {
      logger.info(`Closing database connection...`);
      pgp.end();
    },
    async ensureTriggerAndFunction() {
      logger.info(`Creating function...`);

      // Upsert the function
      await pg.none(`
        CREATE OR REPLACE FUNCTION ${tableName}_insert_fn () RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO ${options.schema}.all_transactions (
            currency_code,
            event_date,
            debit_date,
            event_amount,
            bank_reference,
            event_number,
            account_number,
            account_type,
            is_conversion,
            currency_rate,
            contra_currency_code,
            bank_description,
            original_id,
            id,
            current_balance,
            detailed_bank_description
          ) VALUES (
            new.currency::currency,
            new.value_date::text::date,
            new.value_date::text::date,
            (CASE
                WHEN new.wallet_address = new.from_address THEN (new.amount * -1)
                ELSE new.amount END
            ),
            new.transaction_hash,
            to_char(new.value_date, 'YYYYMMDD')::bigint,
            new.wallet_address,
            concat('crypto_', LOWER(new.currency)),
            false,
            0,
            NULL,
            '',
            new.tx_id,
            gen_random_uuid(),
            0,
            ''
          );

          RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
      `);

      // Upsert the trigger
      logger.info(`Creating trigger...`);

      const { count } = await pg.one<{ count: string }>(`select count(*) as count
      from pg_trigger
      where not tgisinternal
      and tgname = '${tableName}_insert_trigger';`);

      // TODO: We can drop this when we move to PG>=13
      if (parseInt(count) === 1) {
        logger.info(`Function already exists, deleting and placing a new one...`);

        await pg.none(
          `DROP TRIGGER ${tableName}_insert_trigger ON ${options.schema}.${tableName};`,
        );
      }

      await pg.none(`
        CREATE TRIGGER ${tableName}_insert_trigger
        AFTER INSERT
          ON ${options.schema}.${tableName}
          FOR EACH ROW
        EXECUTE
          PROCEDURE ${tableName}_insert_fn ();
      `);
    },
    async ensureTable() {
      logger.info(`Ensuring table ${tableName} exists...`);

      await pg.none(`
        CREATE TABLE
        IF NOT EXISTS
        ${options.schema}.${tableName} (
          tx_id TEXT PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          contract_address TEXT NOT NULL,
          from_address TEXT NOT NULL,
          to_address TEXT NOT NULL,
          currency TEXT,
          transaction_hash TEXT,
          amount DECIMAL NOT NULL,
          value_date DATE NOT NULL,
          raw_data JSONB NOT NULL
        );
      `);
    },
    async createTransactionRecord(
      walletAddress: string,
      contractAddress: string,
      normalizedTx: NormalizedEtherscanTransaction,
    ) {
      logger.info(`Creating database record for transaction ${normalizedTx.id}...`);

      await pg.none(
        `
        INSERT INTO ${options.schema}.${tableName} (
          tx_id,
          wallet_address,
          contract_address,
          from_address,
          to_address,
          currency,
          amount,
          value_date,
          raw_data,
          transaction_hash
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9:json,
          $10
        )
        ON CONFLICT DO NOTHING;
      `,
        [
          normalizedTx.id,
          walletAddress,
          contractAddress,
          normalizedTx.raw.from,
          normalizedTx.raw.to,
          normalizedTx.currency,
          normalizedTx.tokenAmount,
          normalizedTx.date,
          normalizedTx.raw,
          normalizedTx.raw.blockHash,
        ],
      );
    },
  };
}
