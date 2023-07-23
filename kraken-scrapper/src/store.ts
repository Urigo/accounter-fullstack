import { diary } from 'diary';
import createPgp from 'pg-promise';
import type { KrakenLedgerRecord, KrakenTradeRecord } from './kraken';

const logger = diary('store');
const ledgerTable = `kraken_ledger_records`;
const tradesTable = `kraken_trades`;

export async function createAndConnectStore(options: { connectionString: string; schema: string }) {
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
      logger.info(`Creating ${ledgerTable} function...`);

      // Upsert the function
      await pg.none(`
        CREATE OR REPLACE FUNCTION ${ledgerTable}_insert_fn() RETURNS TRIGGER
          LANGUAGE plpgsql
        AS $$
        DECLARE
            merged_id UUID;
            account_id_var UUID;
            owner_id_var UUID;
            charge_id_var UUID = NULL;
        BEGIN
            -- Create merged raw transactions record:
            INSERT INTO ${options.schema}.transactions_raw_list(kraken_id)
            VALUES (NEW.ledger_id::text)
            RETURNING id INTO merged_id;

            -- get account and owner IDs
            SELECT INTO account_id_var, owner_id_var
                id, owner
            FROM ${options.schema}.financial_accounts
            WHERE account_number = NEW.account_nickname;

            -- create new charge
            IF (charge_id_var IS NULL) THEN
                INSERT INTO ${options.schema}.charges (owner_id, is_conversion)
                VALUES (
                    owner_id_var,
                    (CASE
                      WHEN new.trade_ref_id IS NOT NULL
                      THEN true
                      ELSE false
                END)
                )
                RETURNING id INTO charge_id_var;
            END IF;

            -- create new transaction
            INSERT INTO ${options.schema}.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
            VALUES (
                account_id_var,
                charge_id_var,
                merged_id,
                (CASE
                      WHEN new.trade_ref_id IS NOT NULL
                      THEN new.trade_ref_id
                END),
                NEW.currency::currency,
                NEW.value_date::text::date,
                NEW.value_date::text::date,
                NEW.amount,
                NEW.balance
            );

            -- deprecated fields for ref
            -- INSERT INTO ${options.schema}.all_transactions (
            --     bank_reference,
            --     event_number,
            --     account_type,
            --     currency_rate,
            --     fee
            -- ) VALUES (
            --     new.ledger_id,
            --     to_char(new.value_date, 'YYYYMMDD')::bigint,
            --     (
            --         CASE
            --             WHEN new.currency = 'USD'
            --                 THEN concat('checking_', LOWER(new.currency))
            --             ELSE concat('crypto_', LOWER(new.currency))
            --         END
            --     ),
            --     (CASE
            --           WHEN new.trade_ref_id IS NOT NULL
            --           THEN (SELECT price FROM ${options.schema}.kraken_trades WHERE trade_id = new.trade_ref_id)
            --           ELSE 0
            --     END),
            --     (CASE
            --           WHEN new.trade_ref_id IS NOT NULL
            --           THEN (SELECT fee FROM ${options.schema}.kraken_trades WHERE trade_id = new.trade_ref_id)
            --           ELSE NULL
            --     END)
            -- );

            RETURN NEW;
        END;
        $$;
      `);

      // Upsert the trigger
      logger.info(`Creating ${ledgerTable} trigger...`);

      const { count } = await pg.one<{ count: string }>(`select count(*) as count
      from pg_trigger
      where not tgisinternal
      and tgname = '${ledgerTable}_insert_trigger';`);

      // TODO: We can drop this when we move to PG>=13
      if (parseInt(count) === 1) {
        logger.info(`Function already exists, deleting and placing a new one...`);

        await pg.none(
          `DROP TRIGGER ${ledgerTable}_insert_trigger ON ${options.schema}.${ledgerTable};`,
        );
      }

      await pg.none(`
        CREATE TRIGGER ${ledgerTable}_insert_trigger
        AFTER INSERT
          ON ${options.schema}.${ledgerTable}
          FOR EACH ROW
        EXECUTE
          PROCEDURE ${ledgerTable}_insert_fn ();
      `);
    },
    async ensureTables() {
      logger.info(`Ensuring table ${tradesTable} exists...`);

      await pg.none(`
        CREATE TABLE
        IF NOT EXISTS
        ${options.schema}.${tradesTable} (
          trade_id TEXT PRIMARY KEY,
          account_nickname TEXT NOT NULL,
          pair TEXT NOT NULL,
          value_date TIMESTAMP NOT NULL,
          order_type TEXT NOT NULL,
          price NUMERIC NOT NULL,
          cost NUMERIC NOT NULL,
          fee NUMERIC NOT NULL,
          vol NUMERIC NOT NULL,
          margin NUMERIC NOT NULL,
          raw_data JSONB NOT NULL
        );
      `);

      logger.info(`Ensuring table ${ledgerTable} exists...`);

      await pg.none(`
        CREATE TABLE
        IF NOT EXISTS
        ${options.schema}.${ledgerTable} (
          ledger_id TEXT PRIMARY KEY,
          account_nickname TEXT NOT NULL,
          action_type TEXT NOT NULL,
          currency TEXT NOT NULL,
          amount DECIMAL NOT NULL,
          balance DECIMAL NOT NULL,
          fee DECIMAL NOT NULL,
          value_date TIMESTAMP NOT NULL,
          trade_ref_id TEXT,
          raw_data JSONB NOT NULL
        );
      `);
    },
    async createTradeRecord(accountPrefix: string, tradeId: string, record: KrakenTradeRecord) {
      logger.info(`Creating database trade record for ${tradeId}...`);

      await pg.none(
        `
        INSERT INTO ${options.schema}.${tradesTable} (
          trade_id,
          account_nickname,
          pair,
          value_date,
          order_type,
          price,
          cost,
          fee,
          vol,
          margin,
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
          tradeId,
          `${accountPrefix}${record.pair!}`,
          record.pair,
          new Date(record.time! * 1000),
          record.type,
          record.price,
          record.cost,
          record.fee,
          record.vol,
          record.margin,
          record,
        ],
      );
    },
    async createLedgerRecord(accountPrefix: string, ledgerId: string, record: KrakenLedgerRecord) {
      logger.info(`Creating database ledger record for ${ledgerId}...`);
      const assetName = record.asset!.replace('ZUSD', 'USD');

      await pg.none(
        `
        INSERT INTO ${options.schema}.${ledgerTable} (
          ledger_id,
          account_nickname,
          action_type,
          currency,
          amount,
          balance,
          fee,
          value_date,
          trade_ref_id,
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
          $10:json
        )
        ON CONFLICT DO NOTHING;
      `,
        [
          ledgerId,
          `${accountPrefix}${assetName}`,
          record.type,
          assetName,
          record.amount,
          record.balance,
          record.fee,
          new Date(record.time! * 1000),
          record.type === 'trade' ? record.refid : null,
          record,
        ],
      );
    },
  };
}
