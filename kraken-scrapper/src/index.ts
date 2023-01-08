import { diary, enable as enableLogger } from 'diary';
import { config as loadEnv } from 'dotenv';
import { createKraken } from './kraken.js';
import { createAndConnectStore } from './store.js';
import { ensureEnv } from './utils.js';

loadEnv();
enableLogger(ensureEnv('DEBUG_LOG', '*'));

const logger = diary('main');

async function main() {
  logger.info(`🚀 Kraken Accounter Scrapper started`);
  const accountPrefix = ensureEnv('ACCOUNT_PREFIX', 'kraken_');
  const kraken = createKraken({
    apiKey: ensureEnv('KRAKEN_API_KEY'),
    apiSecret: ensureEnv('KRAKEN_API_SECRET'),
  });

  logger.info(`ℹ️ Fetching Ledger and Trade records from Kraken...`);
  const ledger = await kraken.ledgers();
  const trades = await kraken.trades();

  logger.info(
    `ℹ️ Got total of ${Object.keys(trades).length} trades and ${
      Object.keys(ledger).length
    } ledger records`,
  );

  const store = await createAndConnectStore({
    connectionString: ensureEnv('DATABASE_URL'),
    schema: 'accounter_schema',
  });
  await store.ensureTables();
  // TODO: Enable this one when we make sure it's ready and valid
  // await store.ensureTriggerAndFunction();

  logger.info(`ℹ️ Creating records for Ledger records:`);
  await Promise.all(
    Object.entries(ledger).map(([ledgerId, record]) =>
      store.createLedgerRecord(accountPrefix, ledgerId, record),
    ),
  );
  // We need to create trades after creating the Ledger records, in order to make sure
  // that the TRIGGER call with have everything it needs to operate.
  logger.info(`ℹ️ Creating records for Trades:`);
  await Promise.all(
    Object.entries(trades).map(([tradeId, record]) =>
      store.createTradeRecord(accountPrefix, tradeId, record),
    ),
  );

  await store.close();
  logger.info(`✅ Done!`);
  process.exit(0);
}

main().catch(e => logger.error(e));
