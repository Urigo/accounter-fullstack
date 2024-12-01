import { Frame, Page } from 'puppeteer';
import { subYears } from 'date-fns';
import { waitUntil } from '../helpers/waiting.js';

// Constants
const LOGIN_URL = 'https://www.cal-online.co.il/';
// const TRANSACTIONS_REQUEST_ENDPOINT = 'https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails';
// const PENDING_TRANSACTIONS_REQUEST_ENDPOINT = 'https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests';

// Types
interface Transaction {
  identifier?: string;
  date: string;
  processedDate: string;
  description: string;
  memo: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending';
  type: 'regular' | 'installments';
  installments?: {
    number: number;
    total: number;
  };
}

// Main scraper functions
export async function cal(page: Page, credentials: CalCredentials, options: CalOptions = {}) {
  await login(credentials, page);
  return fetchTransactions(page, credentials, options);
}

async function login(credentials: CalCredentials, page: Page) {
  await page.goto(LOGIN_URL);
  
  // Wait for and click the login button
  await page.waitForSelector('#ccLoginDesktopBtn', { visible: true });
  await page.click('#ccLoginDesktopBtn');
  
  // Get the login frame using the proper frame detection
  const frame = await getLoginFrame(page);
  
  // Switch to regular login tab
  await waitUntilElementFound(frame, '#regular-login');
  await frame.click('#regular-login');
  await waitUntilElementFound(frame, 'regular-login'); // Wait for tab to be active
  
  // Fill login form within the frame
  await waitUntilElementFound(frame, '[formcontrolname="userName"]');
  await frame.type('[formcontrolname="userName"]', credentials.username);
  await frame.type('[formcontrolname="password"]', credentials.password);
  
  // Submit the form
  await waitUntilElementFound(frame, 'button[type="submit"]');
  await frame.click('button[type="submit"]');

  console.debug('Clicked sign in');
  
  // Handle post-login scenarios
  try {
    // Wait for navigation
    await Promise.race([
      page.waitForNavigation(),
      page.waitForSelector('button.btn-close'),
    ]);
    
    // Check if we're on the tutorial page and close it if needed
    const currentUrl = page.url();
    if (currentUrl.endsWith('site-tutorial')) {
      await page.click('button.btn-close');
    }
    
    // Check for password change requirement
    const passwordChangeForm = await page.$('form[name="changePasswordForm"]');
    if (passwordChangeForm) {
      throw new Error('Password change required');
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Password change required') {
      throw e;
    }
    
    // Check if we successfully reached the dashboard
    const currentUrl = page.url();
    if (!currentUrl.includes('dashboard')) {
      throw new Error('Login failed');
    }
  }
}

async function fetchTransactions(page: Page, credentials: CalCredentials, options: CalOptions = {}) {
  const startDate = options.startDate || subYears(new Date(), 1);
  console.debug('startDate', startDate);
  const authToken = await getAuthorizationHeader(page);
  console.debug('authToken', authToken);
  const cards = await getCards(page);

  const transactions: Transaction[] = [];

  for (const card of cards) {
    console.debug('card', card);
    // // Fetch pending transactions
    // const pendingTxns = await fetchPendingTransactions(page, card.id, authToken);
    // transactions.push(...pendingTxns);

    // // Fetch completed transactions
    // const completedTxns = await fetchCompletedTransactions(page, card.id, authToken, startDate);
    // transactions.push(...completedTxns);
  }

  return transactions;
}

// Helper functions
async function getLoginFrame(page: Page) {
  let frame: Frame | null = null;
  console.debug('wait until login frame found');
  await waitUntil(() => {
    // find iframe with src: https://connect.cal-online.co.il/index.html
    const frames = page.frames();
    frame = frames.find((f) => f.url().includes('connect')) || null;
    return Promise.resolve(!!frame);
  }, 'wait for iframe with login form', 10_000, 1000);

  if (!frame) {
    console.debug('failed to find login frame for 10 seconds');
    throw new Error('failed to extract login iframe');
  }

  return frame as Frame;
}

async function getCards(page: Page) {
  const initData = await waitUntil(
    () => getFromSessionStorage<{
      result: {
        cards: {
          cardUniqueId: string;
          last4Digits: string;
          [key: string]: unknown;
        }[];
      };
    }>(page, 'init'),
    'get init data in session storage',
    10_000,
    1000,
  );
  if (!initData) {
    throw new Error('could not find \'init\' data in session storage');
  }
  return initData?.result.cards.map(({ cardUniqueId, last4Digits }) => ({ cardUniqueId, last4Digits }));
}

async function getFromSessionStorage<T>(page: Page, key: string): Promise<T | null> {
  const strData = await page.evaluate((k: string) => {
    return sessionStorage.getItem(k);
  }, key);

  if (!strData) return null;

  return JSON.parse(strData) as T;
}

async function getAuthorizationHeader(page: Page) {
  const authModule = await getFromSessionStorage<{ auth: { calConnectToken: string } }>(page, 'auth-module');
  if (!authModule) {
    throw new Error('could not find \'auth-module\' in session storage');
  }
  return `CALAuthScheme ${authModule.auth.calConnectToken}`;
}

async function waitUntilElementFound(page: Page | Frame, elementSelector: string,
  onlyVisible = false, timeout = 10_000) {
  await page.waitForSelector(elementSelector, { visible: onlyVisible, timeout });
}

// Classes
export class CalCredentials {
  username: string = '';
  password: string = '';
}

export class CalOptions {
  startDate?: Date;
  futureMonthsToScrape?: number = 1;
}
