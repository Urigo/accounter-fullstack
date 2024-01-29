import { existsSync, readFileSync } from 'node:fs';
import { diary, enable as enableLogger } from 'diary';
import { config as loadEnv } from 'dotenv';
import { createEtana } from './etana.js';
import { createAndConnectStore } from './store.js';
import { ensureEnv } from './utils.js';

loadEnv();
enableLogger(ensureEnv('DEBUG_LOG', '*'));

const logger = diary('main');

async function main() {
  logger.info(`🚀 Etana Accounter Scrapper started`);
  const csvFilePath = ensureEnv('CSV_EXPORT_FILEPATH');
  logger.info(`Using CSV file path: "${csvFilePath}"`);

  if (!existsSync(csvFilePath)) {
    throw new Error(
      `Failed to load file "${csvFilePath}" (from cwd: "${process.cwd()}"), file does not exists`,
    );
  }

  logger.info(`Loading CSV content from path: "${csvFilePath}"...`);
  const csvContent = readFileSync(csvFilePath, 'utf-8');

  const etana = createEtana({
    csvContent,
  });

  const transactions = await etana.accountTransactions();
  logger.info(`ℹ️ Got total of ${transactions.length} Etana account transactions`);
  const mergedTransactions = etana.processTransactions(transactions);

  const store = await createAndConnectStore({
    connectionString: ensureEnv('DATABASE_URL'),
    schema: 'accounter_schema',
  });
  await store.ensureTable();
  await store.ensureTriggerAndFunction();

  logger.info(`ℹ️ Writing Etana account transactions to the database...`);
  await Promise.all(mergedTransactions.map(t => store.storeTransaction(t)));

  await store.close();
  logger.info(`✅ Done!`);
  process.exit(0);
}

main().catch(e => logger.error(e));
