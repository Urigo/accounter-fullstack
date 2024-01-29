import { diary, enable as enableLogger } from 'diary';
import { config as loadEnv } from 'dotenv';
import { createEtherscan } from './etherscan.js';
import { createAndConnectStore } from './store.js';
import { ensureEnv } from './utils.js';

loadEnv();
enableLogger(ensureEnv('DEBUG_LOG', '*'));

const logger = diary('main');

async function main() {
  logger.info(`🚀 Etherscan Accounter Scrapper started`);
  const etherscanApiKey = ensureEnv('ETHERSCAN_API_KEY');
  const etherscan = createEtherscan({ apiKey: etherscanApiKey });
  const walletsToScan = ensureEnv('WALLETS_TO_SCAN').split(',');

  if (walletsToScan.length === 0) {
    throw new Error('No wallets to scan, please set WALLETS_TO_SCAN correctly!');
  }

  logger.info(`ℹ️ Input is total of ${walletsToScan.length} wallets, scanning...`);

  const transactionsGroups = await Promise.all(
    walletsToScan.map(async walletAddressPair => {
      const [wallet, contractAddress] = walletAddressPair.split(':');

      if (!wallet || !contractAddress) {
        throw new Error(
          `Invalid wallet address pair: ${walletAddressPair}, please note that the format should be WALLET:CONTRACT_ADDRESS`,
        );
      }

      logger.info(`🔍 Scanning wallet ${wallet} on contract ${contractAddress}`);
      const transactions = await etherscan.listTokensTransactionsForWallet(wallet, contractAddress);
      logger.info(
        `ℹ️ Done scanning ${wallet}/${contractAddress}, found total of ${transactions.length} transactions`,
      );

      return {
        walletAddress: wallet,
        contractAddress,
        currency: transactions[0].currency || null,
        transactions,
      };
    }),
  );

  logger.info(
    `✅ Total of ${transactionsGroups.length} accounts found, will now save to the database...`,
  );

  const store = await createAndConnectStore({
    connectionString: ensureEnv('DATABASE_URL'),
    schema: 'accounter_schema',
  });
  await store.ensureTable();
  await store.ensureTriggerAndFunction();

  await Promise.all(
    transactionsGroups.map(group =>
      Promise.all(
        group.transactions.map(tx =>
          store.createTransactionRecord(group.walletAddress, group.contractAddress, tx),
        ),
      ),
    ),
  );

  await store.close();
  logger.info(`✅ Done!`);
  process.exit(0);
}

main().catch(e => logger.error(e));
