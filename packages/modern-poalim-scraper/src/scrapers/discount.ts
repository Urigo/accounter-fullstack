import { type Page } from 'puppeteer';
import { subYears, format, addMonths, min } from 'date-fns';
import { waitUntilElementFound } from '../utils/browser-util.js';
import { fetchGetWithinPage } from '../utils/fetch.js';
import { sleep } from '../utils/sleep.js';
import { zodLastTransactionsSchema } from '../scrapers/types/discount/get-last-transactions.js';
import { getAccountSchema } from '../scrapers/types/discount/get-account.js';

const BASE_URL = 'https://start.telebank.co.il';
const LOGIN_URL = `${BASE_URL}/login/#/LOGIN_PAGE_SME`; // `/LOGIN_PAGE` instead if logging in to a personal account

export async function discount(page: Page, credentials: DiscountCredentials, options: DiscountOptions = {}) {
  console.debug('Starting discount');
  await login(credentials, page);

  return {
    getMonthTransactions: async (month: Date) => {
      console.log('getMonthTransactions');
      const txData = await fetchTransactions(page, month);
      console.log(`Got ${txData.transactions.length} transactions for ${format(month, 'yyyy-MM')}`);
      console.log(txData);
      return txData;
    },
    getTransactions: async () => {
      const startDate = options.startDate || subYears(new Date(), 2);
      const endDate = new Date();

      const txs = [];
      let currentDate = startDate;

      while (currentDate <= endDate) {
        const txData = await fetchTransactions(page, currentDate);
        console.log(txData);
        txs.push(txData);
        currentDate = addMonths(currentDate, 1);
      }
      
      return txs;
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

async function fetchTransactions(page: Page, month: Date) {
  const apiSiteUrl = `${BASE_URL}/Titan/gatewayAPI`;

  const accountDataUrl = `${apiSiteUrl}/userAccounts/bsUserAccountsData?FetchAccountsNickName=true&FirstTimeEntry=false`;
  const accountInfo = await fetchGetWithinPage(page, accountDataUrl);
  
  const parsedAccountInfo = getAccountSchema.safeParse(accountInfo);
  if (!parsedAccountInfo.success) {
    console.error('failed to parse response', parsedAccountInfo.error);
    throw new Error('Failed to parse response', parsedAccountInfo.error);
  }

  const accountNumber = parsedAccountInfo.data.UserAccountsData.DefaultAccountNumber;

  const startDate = month;
  const startDateStr = format(startDate, 'yyyyMMdd');
  
  const endDate = addMonths(month, 1);
  const endMoment = min([endDate, new Date()]);
  const endDateStr = format(endMoment, 'yyyyMMdd');

  const txnsUrl = `${apiSiteUrl}/lastTransactions/${accountNumber}/Date?IsCategoryDescCode=True&IsTransactionDetails=True&IsEventNames=True&IsFutureTransactionFlag=True&FromDate=${startDateStr}&ToDate=${endDateStr}`;
  const txnsResult = await fetchGetWithinPage(page, txnsUrl);
  
  const { success, data, error } = zodLastTransactionsSchema.safeParse(txnsResult);
  if (!success) {
    console.error('failed to parse response', error);
    throw new Error('Failed to parse response', error);
  }

  const accountData = {
    success: true,
    accountNumber,
    balance: data.CurrentAccountLastTransactions.CurrentAccountInfo.AccountBalance,
    transactions: data.CurrentAccountLastTransactions.OperationEntry,
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
