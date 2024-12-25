import { type Page } from 'puppeteer';
import { addDays, subYears, max, format, parse } from 'date-fns';
import { waitUntilElementFound } from '../utils/browser-util.js';
import { fetchGetWithinPage } from '../utils/fetch.js';
import { sleep } from 'packages/modern-poalim-scraper/src/utils/sleep.js';

const BASE_URL = 'https://start.telebank.co.il';
const LOGIN_URL = `${BASE_URL}/login/#/LOGIN_PAGE_SME`; // `/LOGIN_PAGE` instead if logging in to a personal account
const DATE_FORMAT = 'YYYYMMDD';

enum TransactionStatuses {
  Completed = 'completed',
  Pending = 'pending',
}

enum TransactionTypes {
  Normal = 'normal',
  Installments = 'installments',
}

interface ScrapedTransaction {
  OperationNumber: number;
  OperationDate: string;
  ValueDate: string;
  OperationAmount: number;
  OperationDescriptionToDisplay: string;
}

interface CurrentAccountInfo {
  AccountBalance: number;
}

interface ScrapedAccountData {
  UserAccountsData: {
    DefaultAccountNumber: string;
  };
}

interface ScrapedTransactionData {
  Error?: { MsgText: string };
  CurrentAccountLastTransactions?: {
    OperationEntry: ScrapedTransaction[];
    CurrentAccountInfo: CurrentAccountInfo;
    FutureTransactionsBlock:{
      FutureTransactionEntry: ScrapedTransaction[];
    };
  };
}

export async function discount(page: Page, credentials: DiscountCredentials, _options: DiscountOptions = {}) {
  await login(credentials, page);

  return {
    getMonthTransactions: async (_last4Digits: string, _month: Date) => {
      return [];
    },
    getTransactions: async () => {
      return [];
    },
  }
}


async function login(credentials: DiscountCredentials, page: Page) {
  await page.goto(LOGIN_URL);

  // Wait for and click the login button
  await waitUntilElementFound(page, '#tzId', true);
  
  // Fill login form
  await page.type('#tzId', credentials.ID);
  await page.type('#tzPassword', credentials.password);
  if (credentials.code) {
    await page.type('#aidnum', credentials.code);
  }
  
  // TODO: see if we can remove this
  await sleep(5000);

  // Wait for submit button and click
  await waitUntilElementFound(page, '.sendBtn');
  await page.click('.sendBtn');

  // Handle post-login scenarios
  try {
    // Wait for either navigation or error
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      waitUntilElementFound(page, '#general-error', true),
    ]);
    
    // Check for password change requirement
    const passwordChangeForm = await page.$('form[name="changePasswordForm"]');
    if (passwordChangeForm) {
      throw new Error('Password change required');
    }

    // Wait for dashboard to load
    await page.waitForFunction(() => 
      window.location.href.includes('MY_ACCOUNT_HOMEPAGE')
    );

  } catch (e) {
    if (e instanceof Error && e.message === 'Password change required') {
      throw e;
    }
    
    // Check if login failed
    const errorElement = await page.$('#general-error');
    if (errorElement) {
      throw new Error('Login failed');
    }
    
    // Check if we successfully reached the dashboard
    const currentUrl = page.url();
    if (!currentUrl.includes('MY_ACCOUNT_HOMEPAGE')) {
      throw new Error('Login failed');
    }
  }
}


function convertTransactions(txns: ScrapedTransaction[], txnStatus: TransactionStatuses) {
  if (!txns) {
    return [];
  }
  return txns.map((txn) => {
    return {
      type: TransactionTypes.Normal,
      identifier: txn.OperationNumber,
      date: parse(txn.OperationDate, DATE_FORMAT, new Date()).toISOString(),
      processedDate: parse(txn.ValueDate, DATE_FORMAT, new Date()).toISOString(),
      originalAmount: txn.OperationAmount,
      originalCurrency: 'ILS',
      chargedAmount: txn.OperationAmount,
      description: txn.OperationDescriptionToDisplay,
      status: txnStatus,
    };
  });
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchAccountData(page: Page, options: DiscountOptions) {
  const apiSiteUrl = `${BASE_URL}/Titan/gatewayAPI`;

  const accountDataUrl = `${apiSiteUrl}/userAccountsData`;
  const accountInfo = await fetchGetWithinPage<ScrapedAccountData>(page, accountDataUrl);

  if (!accountInfo) {
    return {
      success: false,
      errorMessage: 'failed to get account data',
    };
  }
  const accountNumber = accountInfo.UserAccountsData.DefaultAccountNumber;

  const defaultStartDate = addDays(subYears(new Date(), 1), 2);
  const startDate = options.startDate || defaultStartDate;
  const startMoment = max([defaultStartDate, startDate]);

  const startDateStr = format(startMoment, 'yyyyMMdd');
  const txnsUrl = `${apiSiteUrl}/lastTransactions/${accountNumber}/Date?IsCategoryDescCode=True&IsTransactionDetails=True&IsEventNames=True&IsFutureTransactionFlag=True&FromDate=${startDateStr}`;
  const txnsResult = await fetchGetWithinPage<ScrapedTransactionData>(page, txnsUrl);
  if (!txnsResult || txnsResult.Error ||
    !txnsResult.CurrentAccountLastTransactions) {
    return {
      success: false,
      errorMessage: txnsResult?.Error ? txnsResult.Error.MsgText : 'unknown error',
    };
  }

  const completedTxns = convertTransactions(
    txnsResult.CurrentAccountLastTransactions.OperationEntry,
    TransactionStatuses.Completed,
  );
  const rawFutureTxns = txnsResult?.CurrentAccountLastTransactions?.FutureTransactionsBlock?.FutureTransactionEntry;
  const pendingTxns = convertTransactions(rawFutureTxns, TransactionStatuses.Pending);

  const accountData = {
    success: true,
    accounts: [{
      accountNumber,
      balance: txnsResult.CurrentAccountLastTransactions.CurrentAccountInfo.AccountBalance,
      txns: [...completedTxns, ...pendingTxns],
    }],
  };

  return accountData;
}

// async function navigateOrErrorLabel(page: Page) {
//   try {
//     await waitForNavigation(page);
//   } catch {
//     await waitUntilElementFound(page, '#general-error', false, 100);
//   }
// }

export class DiscountCredentials {
  ID: string = '';
  password: string = '';
  code?: string;
}

export class DiscountOptions {
  startDate?: Date;
}
