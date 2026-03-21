import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
import type { Pool } from 'pg';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type MizrahiCredentials = {
  username: string;
  password: string;
  nickname?: string;
};

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
): Promise<boolean> {
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
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error inserting Mizrahi transaction:', error);
    return false;
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
    startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
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

  let total = 0;
  let inserted = 0;

  for (const account of result.accounts ?? []) {
    for (const txn of account.txns) {
      total++;
      const saved = await saveTransaction(account.accountNumber, txn, pool);
      if (saved) inserted++;
    }
  }

  console.log(`Mizrahi [${label}]: ${inserted}/${total} transactions saved`);
}
