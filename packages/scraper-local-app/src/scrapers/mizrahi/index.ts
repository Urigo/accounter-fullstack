import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
import type { Pool } from 'pg';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type MizrahiCredentials = {
  username: string;
  password: string;
  nickname?: string;
};

export type SaveTransactionResult = 'inserted' | 'duplicate' | 'error';

export async function saveTransaction(
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
): Promise<SaveTransactionResult> {
  try {
    const result = await pool.query(
      `INSERT INTO accounter_schema.bank_mizrahi_transactions (
        account_number, transaction_identifier, date, processed_date,
        original_amount, original_currency, charged_amount, description, memo, status, type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (account_number, transaction_identifier) DO NOTHING
      RETURNING id`,
      [
        accountNumber,
        transaction.identifier?.toString() ?? null,
        transaction.date,
        transaction.processedDate,
        transaction.originalAmount,
        transaction.originalCurrency,
        transaction.chargedAmount,
        transaction.description,
        transaction.memo ?? null,
        transaction.status,
        transaction.type,
      ],
    );
    return (result.rowCount ?? 0) > 0 ? 'inserted' : 'duplicate';
  } catch (error) {
    console.error('Error inserting Mizrahi transaction:', error);
    return 'error';
  }
}

export async function scrapeMizrahi(credentials: MizrahiCredentials, pool: Pool): Promise<void> {
  const { username, password, nickname } = credentials;
  const label = nickname ?? username;

  if (!username || !password) {
    throw new Error(`Mizrahi [${label}]: Missing credentials`);
  }

  console.log(`Mizrahi [${label}]: Logging in...`);

  puppeteerExtra.use(StealthPlugin());
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const scraper = createScraper({
    companyId: CompanyTypes.mizrahi,
    startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 2)),
    combineInstallments: false,
    browser,
  } as Parameters<typeof createScraper>[0]);

  let result: Awaited<ReturnType<typeof scraper.scrape>>;
  try {
    result = await scraper.scrape({ username, password });
  } finally {
    await browser.close().catch(() => null);
  }

  if (!result.success) {
    throw new Error(
      `Mizrahi [${label}]: Scraping failed - ${result.errorType}: ${result.errorMessage}`,
    );
  }

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const account of result.accounts ?? []) {
    for (const txn of account.txns) {
      const outcome = await saveTransaction(account.accountNumber, txn, pool);
      if (outcome === 'inserted') inserted++;
      else if (outcome === 'duplicate') duplicates++;
      else errors++;
    }
  }

  const total = inserted + duplicates + errors;
  const parts = [`${inserted} new`];
  if (duplicates > 0) parts.push(`${duplicates} already synced`);
  if (errors > 0) parts.push(`${errors} errors`);
  console.log(`Mizrahi [${label}]: ${total} fetched — ${parts.join(', ')}`);
}
