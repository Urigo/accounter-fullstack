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
  const accountPrefix = ensureEnv('ACCOUNT_PREFIX', 'kraken');
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
  await store.ensureTriggerAndFunction();

  // We need to create trades before creating the Ledger records, in order to make sure
  // that the TRIGGER call on "ledger_records" table will have everything it needs to operate.
  logger.info(`ℹ️ Creating records for Trades:`);
  await Promise.all(
    Object.entries(trades).map(([tradeId, record]) =>
      store.createTradeRecord(accountPrefix, tradeId, record),
    ),
  );

  logger.info(`ℹ️ Creating records for Ledger records:`);
  for (const [ledgerId, record] of Object.entries(ledger)) {
    // creating serially to enable the TRIGGER to properly match trade records
    await store.createLedgerRecord(accountPrefix, ledgerId, record);
  }

  await store.close();
  logger.info(`✅ Done!`);
  process.exit(0);
}

main().catch(e => logger.error(e));
