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
        INSERT INTO ${options.schema}.transactions_raw_list(etherscan_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;
    
        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var
            id, owner
        FROM ${options.schema}.financial_accounts
        WHERE account_number = NEW.wallet_address;
    
        -- create new charge
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
            '',
            NEW.currency::${options.schema}.currency,
            NEW.value_date::text::date,
            NEW.value_date::text::date,
            (CASE
                WHEN NEW.wallet_address = NEW.from_address THEN (NEW.amount * -1)
                ELSE NEW.amount END
            ),
            0
        );

        -- if fee is not null, create new fee transaction
        IF (NEW.gas_fee IS NOT NULL) THEN
          INSERT INTO ${options.schema}.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
          VALUES (
              account_id_var,
              charge_id_var,
              merged_id,
              CONCAT_WS(' ', 'Fee:', NEW.id::text),
              'ETH'::${options.schema}.currency,
              NEW.value_date::text::date,
              NEW.value_date::text::date,
              (NEW.gas_fee * -1),
              0
          )
          RETURNING id INTO transaction_id_var;
          
          INSERT INTO ${options.schema}.transactions_fees (id)
          VALUES (
            transaction_id_var
          );
        END IF;
    
        RETURN NEW;
      END;
    $$;
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
          PROCEDURE ${options.schema}.${tableName}_insert_fn ();
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
          eventDate TIMESTAMP NOT NULL,
          raw_data JSONB NOT NULL,
          gas_fee NUMERIC NOT NULL,
          id UUID DEFAULT uuid_generate_v4()
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
          transaction_hash,
          event_date,
          gas_fee
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
          $10,
          to_timestamp($11),
          $12
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
          normalizedTx.raw.timeStamp,
          normalizedTx.gasFee,
        ],
      );
    },
  };
}
