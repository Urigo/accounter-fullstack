import { diary } from 'diary';
import createPgp from 'pg-promise';
import type { KrakenLedgerRecord, KrakenTradeRecord } from './kraken';

const logger = diary('store');

export async function createAndConnectStore(options: { connectionString: string; schema: string }) {
  const ledgerTable = `kraken_ledger_records`;
  const tradesTable = `kraken_trades`;

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
      // TODO: implement this one
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
          value_date DATE NOT NULL,
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
          value_date DATE NOT NULL,
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
