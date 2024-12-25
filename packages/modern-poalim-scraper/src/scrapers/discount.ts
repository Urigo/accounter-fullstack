import { type Page } from 'puppeteer';
import { addDays, subYears, max, format, parse } from 'date-fns';
import { waitUntilElementFound } from '../utils/browser-util.js';
import { fetchGetWithinPage } from '../utils/fetch.js';
import { sleep } from '../utils/sleep.js';
import { type DiscountTransaction, zodLastTransactionsSchema } from 'packages/modern-poalim-scraper/src/scrapers/types/discount/get-last-transactions.js';

const BASE_URL = 'https://start.telebank.co.il';
const LOGIN_URL = `${BASE_URL}/login/#/LOGIN_PAGE_SME`; // `/LOGIN_PAGE` instead if logging in to a personal account
const DATE_FORMAT = 'yyyyMMdd';

enum TransactionStatuses {
  Completed = 'completed',
  Pending = 'pending',
}

enum TransactionTypes {
  Normal = 'normal',
  Installments = 'installments',
}

interface ScrapedAccountData {
  UserAccountsData: {
    DefaultAccountNumber: string;
  };
}


export async function discount(page: Page, credentials: DiscountCredentials, options: DiscountOptions = {}) {
  console.debug('Starting discount');
  await login(credentials, page);

  return {
    getMonthTransactions: async (_month: Date) => {
      console.log('getMonthTransactions');
      const accountData = await fetchAccountData(page, options);
      console.log(accountData);
      return [];
    },
    getTransactions: async () => {
      return [];
    },
  }
}

async function login(credentials: DiscountCredentials, page: Page) {
  console.debug('Logging in to Discount');
  await page.goto(LOGIN_URL);

  // Wait for and click the login button
  await waitUntilElementFound(page, '#tzId', true);
  
  console.debug('Filling in login form');
  
  // Fill login form
  await page.type('#tzId', credentials.ID);
  await page.type('#tzPassword', credentials.password);
  if (credentials.code) {
    await page.type('#aidnum', credentials.code);
  }
  
  // TODO: see if we can remove this
  await sleep(3000);

  console.debug('Clicking login button');

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

function convertTransactions(txns: DiscountTransaction[], txnStatus: TransactionStatuses) {
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

async function fetchAccountData(page: Page, options: DiscountOptions) {
  const apiSiteUrl = `${BASE_URL}/Titan/gatewayAPI`;

  const accountDataUrl = `${apiSiteUrl}/userAccounts/bsUserAccountsData?FetchAccountsNickName=true&FirstTimeEntry=false`;
  const accountInfo = await fetchGetWithinPage<ScrapedAccountData>(page, accountDataUrl);
  if (!accountInfo) {
    console.error('failed to get account data');
    return { success: false, errorMessage: 'failed to get account data' };
  }

  const accountNumber = accountInfo.UserAccountsData.DefaultAccountNumber;
  console.log("🚀 ~ fetchAccountData ~ accountNumber:", accountNumber)

  const defaultStartDate = addDays(subYears(new Date(), 1), 2);
  const startDate = options.startDate || defaultStartDate;
  const startMoment = max([defaultStartDate, startDate]);

  const startDateStr = format(startMoment, 'yyyyMMdd');
  const txnsUrl = `${apiSiteUrl}/lastTransactions/${accountNumber}/Date?IsCategoryDescCode=True&IsTransactionDetails=True&IsEventNames=True&IsFutureTransactionFlag=True&FromDate=${startDateStr}`;
  const txnsResult = await fetchGetWithinPage(page, txnsUrl);
  
  const { success, data } = zodLastTransactionsSchema.safeParse(txnsResult);
  if (!success) {
    console.error('failed to parse transactions', data);
    return {
      success: false,
      errorMessage: 'failed to parse transactions',
    };
  }

  const completedTxns = convertTransactions(
    data.CurrentAccountLastTransactions.OperationEntry,
    TransactionStatuses.Completed,
  );

  const accountData = {
    success: true,
    accounts: [{
      accountNumber,
      balance: data.CurrentAccountLastTransactions.CurrentAccountInfo.AccountBalance,
      txns: completedTxns,
    }],
  };

  return accountData;
}

export class DiscountCredentials {
  ID: string = '';
  password: string = '';
  code?: string;
}

export class DiscountOptions {
  startDate?: Date;
}
