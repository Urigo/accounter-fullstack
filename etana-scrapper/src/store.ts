import { diary } from 'diary';
import createPgp from 'pg-promise';
import type { EtanaAccountTransaction } from './etana';

const logger = diary('store');

export async function createAndConnectStore(options: { connectionString: string; schema: string }) {
  const tableName = `etana_account_transactions`;

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
            new.currency,
            new.time::text::date,
            new.time::text::date,
            new.amount,
            new.transaction_id,
            new.ref,
            new.account_id,
            new.currency,
            false,
            0,
            NULL,
            new.description,
            new.transaction_id,
            gen_random_uuid(),
            0,
            new.transaction_ref
          );

          RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
      `);

      // Upsert the trigger
      await pg.none(`
        CREATE OR REPLACE TRIGGER ${tableName}_insert_trigger
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
          transaction_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          time DATE NOT NULL,
          currency TEXT NOT NULL,
          amount NUMERIC NOT NULL,
          description TEXT NOT NULL,
          transaction_ref TEXT,
          ref TEXT,
          metadata TEXT,
          action_type TEXT,
          raw_data JSONB NOT NULL
        );
      `);
    },
    async storeTransaction(record: EtanaAccountTransaction) {
      logger.info(`Creating record for account transaction id: ${record.transactionId}`);

      await pg.none(
        `
        INSERT INTO ${options.schema}.${tableName} (
          transaction_id,
          account_id,
          time,
          currency,
          amount,
          description,
          transaction_ref,
          ref,
          metadata,
          action_type,
          raw_data
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11:json
        )
        ON CONFLICT DO NOTHING;
      `,
        [
          record.transactionId,
          record.accountId,
          record.time,
          record.currency,
          record.amount,
          record.description,
          record.transactionRef,
          record.ref,
          record.metadata,
          record.actionType,
          record.raw,
        ],
      );
    },
  };
}
