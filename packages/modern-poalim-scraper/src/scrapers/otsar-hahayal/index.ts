import { chromium } from 'playwright';
import { getAccounts } from './accounts.js';
import { getCreditCardTransactions } from './credit-card-transactions.js';
import { getCreditCards } from './credit-cards.js';
import { getForeignTransactions } from './foreign-transactions.js';
import { getIlsTransactions } from './ils-transactions.js';
import { loginAndGetUserData } from './login-fetch-user-data.js';
import { TimelessDateString } from './types.js';

export interface OtsarHahayalCredentials {
  userCode: string;
  password: string;
}

export interface OtsarHahayalOptions {
  fetchIlsTransactions?: boolean;
  fetchForeignTransactions?: boolean;
  fetchCreditCards?: boolean;
  fetchInvestments?: boolean;
  validateSchema?: boolean;
  /**
   * Fetch the card-breakdown drill-down of the bank's credit card debit rows, and set those rows'
   * `originReference` to the debited card's last 4 digits. Other rows' drill-downs are not
   * fetched (with `validateSchema`, every drill-down is fetched and validated anyway). A failed
   * drill-down keeps its row without the card hint.
   */
  fetchCardDebitDetails?: boolean;
  fromDate?: string;
  toDate?: string;
  headless?: boolean;
}

const DEFAULT_OPTIONS: OtsarHahayalOptions = {
  fetchIlsTransactions: true,
  fetchForeignTransactions: true,
  fetchCreditCards: true,
  fetchInvestments: true,
  validateSchema: false,
  fetchCardDebitDetails: true,
};

export async function otsarHahayal(
  credentials: OtsarHahayalCredentials,
  userOptions?: OtsarHahayalOptions,
) {
  const now = new Date();
  const fromDate = new Date(
    now.getFullYear(),
    now.getMonth() - 24,
    now.getDate() + 1,
  ).toISOString();
  const options = { ...DEFAULT_OPTIONS, fromDate, toDate: now.toISOString(), ...userOptions };

  const browser = await chromium.launch({ headless: options.headless === true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // after 5 min close the browser to prevent hanging in case of unforeseen issues
  const timeoutId = setTimeout(
    async () => {
      console.warn('Otsar Hahayal scraper timed out after 5 minutes. Closing browser.');
      await browser.close();
    },
    5 * 60 * 1000,
  );

  const headers = await loginAndGetUserData(credentials, page);

  return {
    // accounts
    getAccounts: async () => getAccounts(page, options),

    // local transactions
    ilsTransactions: async (account: {
      accountNumber: number;
      accountType?: number;
      branch: string;
    }) => getIlsTransactions(page, headers, options, account),

    // foreign transactions
    foreignTransactions: async () => getForeignTransactions(page, options),

    // credit cards
    getCreditCards: async () => getCreditCards(page, options, headers),

    // credit card transactions
    getCreditCardTransactions: async (
      card: {
        resourceId: string;
        cardType: number;
        debitDay: number;
      },
      month: TimelessDateString,
    ) => getCreditCardTransactions(page, headers, options, card, month),

    // investments

    close: async () => {
      clearTimeout(timeoutId);
      await browser.close();
    },
  };
}
