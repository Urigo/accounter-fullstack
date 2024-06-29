import { diary } from 'diary';
import createPgp from 'pg-promise';
import type { ProcessedEtanaAccountTransaction } from './etana';

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
      logger.info(`Ensuring function for table ${tableName} exists...`);

      // Upsert the function
      await pg.none(`
      CREATE OR REPLACE FUNCTION ${options.schema}.${tableName}_insert_fn() RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
        DECLARE
          merged_id UUID;
          account_id_var UUID;
          owner_id_var UUID;
          charge_id_var UUID = NULL;
          transaction_id_var UUID = NULL;
        BEGIN
          -- Create merged raw transactions record:
          INSERT INTO ${options.schema}.transactions_raw_list(etana_id)
          VALUES (NEW.transaction_id::text)
          RETURNING id INTO merged_id;
      
          -- get account and owner IDs
          SELECT INTO account_id_var, owner_id_var
              id, owner
          FROM ${options.schema}.financial_accounts
          WHERE account_number = NEW.account_id;

          -- handle shared charge
          IF (NEW.action_type = 'fee') THEN
              SELECT t.charge_id
              INTO charge_id_var
              FROM ${options.schema}.${tableName} AS s
              LEFT JOIN ${options.schema}.transactions_raw_list tr
              ON tr.etana_id = s.transaction_id::text
              LEFT JOIN ${options.schema}.transactions t
              ON tr.id = t.source_id
              WHERE t.charge_id IS NOT NULL
              AND s.fee_tx_id = NEW.transaction_id;
          ELSEIF (NEW.fee IS NOT NULL) THEN
              SELECT t.charge_id
              INTO charge_id_var
              FROM ${options.schema}.${tableName} AS s
              LEFT JOIN ${options.schema}.transactions_raw_list tr
              ON tr.etana_id = s.transaction_id::text
              LEFT JOIN ${options.schema}.transactions t
              ON tr.id = t.source_id
              WHERE t.charge_id IS NOT NULL
              AND s.transaction_id = NEW.fee_tx_id;
          END IF;
      
          -- if no match, create new charge
          IF (charge_id_var IS NULL) THEN
              INSERT INTO ${options.schema}.charges (owner_id)
              VALUES (
                  owner_id_var
              )
              RETURNING id INTO charge_id_var;
          END IF;
      
          -- create new transaction
          INSERT INTO ${options.schema}.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
          VALUES (
              account_id_var,
              charge_id_var,
              merged_id,
              CONCAT(NEW.description,(
                  CASE
                    WHEN new.fee_tx_id IS NOT NULL
                    THEN (new.fee_tx_id)
                  END)
              ),
              NEW.currency::${options.schema}.currency,
              NEW.time::text::date,
              NEW.time::text::date,
              new.amount,
              0
          )
          RETURNING id INTO transaction_id_var;

          -- extend transaction with fee
          IF (NEW.action_type = 'fee') THEN
              INSERT INTO ${options.schema}.transactions_fees (id)
              VALUES (
                transaction_id_var
              );
          END IF;
      
          RETURN NEW;
        END;
      $$;
      `);

      logger.info(`Ensuring trigger for table ${tableName} exists...`);

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

      // Upsert the trigger
      await pg.none(`
        CREATE TRIGGER ${tableName}_insert_trigger
        AFTER INSERT
          ON ${options.schema}.${tableName}
          FOR EACH ROW
        EXECUTE
          PROCEDURE ${options.schema}.${tableName}_insert_fn ();
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
          fee NUMERIC,
          fee_tx_id TEXT,
          metadata TEXT,
          action_type TEXT NOT NULL,
          raw_data JSONB NOT NULL
        );
      `);
    },
    async storeTransaction(record: ProcessedEtanaAccountTransaction) {
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
          fee,
          fee_tx_id,
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
          record.fee?.amount || null,
          record.fee?.transactionId || null,
          record.metadata,
          record.actionType,
          record.raw,
        ],
      );
    },
  };
}
