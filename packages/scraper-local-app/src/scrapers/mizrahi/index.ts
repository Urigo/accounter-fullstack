import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
import { type ListrRendererFactory, type ListrTaskWrapper } from 'listr2';
import type { Pool } from 'pg';
import { sql } from '@pgtyped/runtime';
import type {
  IInsertMizrahiTransactionParams,
  IInsertMizrahiTransactionQuery,
} from './__generated__/mizrahi.types.js';
import type { Logger } from '../../logger.js';

export type MizrahiCredentials = {
  username: string;
  password: string;
  nickname?: string;
};

const insertMizrahiTransaction = sql<IInsertMizrahiTransactionQuery>`
  INSERT INTO accounter_schema.bank_mizrahi_transactions (
    account_number,
    transaction_identifier,
    date,
    processed_date,
    original_amount,
    original_currency,
    charged_amount,
    description,
    memo,
    status,
    type
  )
  VALUES $transaction(
    accountNumber,
    transactionIdentifier,
    date,
    processedDate,
    originalAmount,
    originalCurrency,
    chargedAmount,
    description,
    memo,
    status,
    type
  )
  ON CONFLICT (account_number, transaction_identifier) DO NOTHING
  RETURNING *;`;

async function saveMizrahiTransactionToDB(
  accountNumber: string,
  transaction: {
    identifier?: number | string;
    date: string;
    processedDate: string;
    originalAmount: number;
    originalCurrency: string;
    chargedAmount: number;
    description: string;
    memo?: string | null;
    status: string;
    type: string;
  },
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  const params: IInsertMizrahiTransactionParams['transaction'] = {
    accountNumber,
    transactionIdentifier: transaction.identifier?.toString() ?? null,
    date: transaction.date,
    processedDate: transaction.processedDate,
    originalAmount: transaction.originalAmount.toString(),
    originalCurrency: transaction.originalCurrency,
    chargedAmount: transaction.chargedAmount.toString(),
    description: transaction.description,
    memo: transaction.memo ?? null,
    status: transaction.status,
    type: transaction.type,
  };

  try {
    await insertMizrahiTransaction.run({ transaction: params }, pool);
    logger.log(`Mizrahi insert: ${transaction.description} ${transaction.chargedAmount}`);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('duplicate key value violates unique constraint')
    ) {
      return false;
    }
    logger.error('Error inserting Mizrahi transaction:', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return false;
  }
}

export async function getMizrahiData(
  credentials: MizrahiCredentials,
  pool: Pool,
  logger: Logger,
  parentTask: ListrTaskWrapper<unknown, ListrRendererFactory, ListrRendererFactory>,
): Promise<void> {
  const { username, password, nickname } = credentials;
  const label = nickname ?? username;

  if (!username || !password) {
    throw new Error(`Mizrahi [${label}]: Missing credentials`);
  }

  parentTask.output = 'Logging in...';

  const scraper = createScraper({
    companyId: CompanyTypes.mizrahi,
    startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    combineInstallments: false,
    showBrowser: false,
  });

  const result = await scraper.scrape({ username, password });

  if (!result.success) {
    throw new Error(`Mizrahi [${label}]: Scraping failed - ${result.errorType}: ${result.errorMessage}`);
  }

  let total = 0;
  let inserted = 0;

  for (const account of result.accounts) {
    for (const txn of account.txns) {
      total++;
      const saved = await saveMizrahiTransactionToDB(account.accountNumber, txn, pool, logger);
      if (saved) inserted++;
    }
  }

  parentTask.title = `${parentTask.title} (${inserted}/${total} transactions)`;
}
