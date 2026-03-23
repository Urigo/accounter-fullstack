import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
import type { Pool } from 'pg';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type IsracardAltCredentials = {
  id: string;
  password: string;
  card6Digits: string;
  nickname?: string;
};

async function saveTransaction(
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
      `INSERT INTO accounter_schema.isracard_alt_transactions (
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
    console.error('Error inserting Isracard transaction:', error);
    return false;
  }
}

export async function scrapeIsracardAlt(
  credentials: IsracardAltCredentials,
  pool: Pool,
  showBrowser = false,
): Promise<void> {
  const { id, password, card6Digits, nickname } = credentials;
  const label = nickname ?? id;

  if (!id || !password || !card6Digits) {
    throw new Error(`Isracard [${label}]: Missing credentials`);
  }

  console.log(`Isracard [${label}]: Logging in...`);

  puppeteerExtra.use(StealthPlugin());
  const browser = await puppeteerExtra.launch({
    headless: !showBrowser,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  const scraper = createScraper({
    companyId: CompanyTypes.isracard,
    startDate,
    combineInstallments: false,
    browser,
  } as Parameters<typeof createScraper>[0]);

  let result: Awaited<ReturnType<typeof scraper.scrape>>;
  try {
    result = await scraper.scrape({ id, password, card6Digits });
  } finally {
    await browser.close().catch(() => null);
  }

  if (!result.success) {
    const msg = `Isracard [${label}]: Scraping failed - ${result.errorType}: ${result.errorMessage}`;
    console.error(msg);
    throw new Error(msg);
  }

  const accounts = result.accounts ?? [];
  console.log(`Isracard [${label}]: Found ${accounts.length} account(s)`);

  let total = 0;
  let inserted = 0;

  for (const account of accounts) {
    console.log(
      `Isracard [${label}]: Account ${account.accountNumber} - ${account.txns.length} transactions`,
    );
    for (const txn of account.txns) {
      total++;
      const saved = await saveTransaction(account.accountNumber, txn, pool);
      if (saved) inserted++;
    }
  }

  console.log(`Isracard [${label}]: ${inserted}/${total} transactions saved`);
}
