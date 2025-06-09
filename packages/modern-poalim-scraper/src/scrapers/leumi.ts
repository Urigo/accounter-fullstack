/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays, format, max, setMilliseconds, subYears } from 'date-fns';
import {
  type Frame,
  type Page,
  type PuppeteerLifeCycleEvent,
  type WaitForOptions,
} from 'puppeteer';

interface FutureDebit {
  amount: number;
  amountCurrency: string;
  chargeDate?: string;
  bankAccountNumber?: string;
}

export type LeumiOptions = {
  /**
   * the date to fetch transactions from (can't be before the minimum allowed time difference for the scraper)
   */
  startDate?: Date;

  /**
   * if set, will set the timeout in milliseconds of puppeteer's `page.setDefaultTimeout`.
   */
  defaultTimeout?: number;

  /**
   * shows the browser while scraping, good for debugging (default false)
   */
  showBrowser?: boolean;

  /**
   * Maximum navigation time in milliseconds, pass 0 to disable timeout.
   * @default 30000
   */
  timeout?: number;
};

interface ScraperScrapingResult {
  success: boolean;
  accounts?: TransactionsAccount[];
  futureDebits?: FutureDebit[];
  errorType?: ScraperErrorTypes;
  errorMessage?: string; // only on success=false
}

enum ScraperErrorTypes {
  TwoFactorRetrieverMissing = 'TWO_FACTOR_RETRIEVER_MISSING',
  InvalidPassword = 'INVALID_PASSWORD',
  ChangePassword = 'CHANGE_PASSWORD',
  Timeout = 'TIMEOUT',
  AccountBlocked = 'ACCOUNT_BLOCKED',
  Generic = 'GENERIC',
  General = 'GENERAL_ERROR',
}

class TimeoutError extends Error {}

interface TransactionsAccount {
  accountNumber: string;
  balance?: number | undefined;
  txns: Transaction[];
}

enum TransactionTypes {
  Normal = 'normal',
  Installments = 'installments',
}

enum TransactionStatuses {
  Completed = 'completed',
  Pending = 'pending',
}

interface TransactionInstallments {
  /**
   * the current installment number
   */
  number: number;

  /**
   * the total number of installments
   */
  total: number;
}

interface Transaction {
  type: TransactionTypes;
  /**
   * sometimes called Asmachta
   */
  identifier?: string | number;
  /**
   * ISO date string
   */
  date: string;
  /**
   * ISO date string
   */
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency?: string;
  description: string;
  memo?: string;
  status: TransactionStatuses;
  installments?: TransactionInstallments;
  category?: string;
}

type ErrorResult = {
  success: false;
  errorType: ScraperErrorTypes;
  errorMessage: string;
};

function createErrorResult(errorType: ScraperErrorTypes, errorMessage: string): ErrorResult {
  return {
    success: false,
    errorType,
    errorMessage,
  };
}

function createTimeoutError(errorMessage: string): ErrorResult {
  return createErrorResult(ScraperErrorTypes.Timeout, errorMessage);
}

function createGenericError(errorMessage: string): ErrorResult {
  return createErrorResult(ScraperErrorTypes.Generic, errorMessage);
}

function getCurrentUrl(pageOrFrame: Page | Frame, clientSide = false) {
  if (clientSide) {
    return pageOrFrame.evaluate(() => window.location.href);
  }

  return pageOrFrame.url();
}

async function waitForNavigation(pageOrFrame: Page | Frame, options?: WaitForOptions) {
  await pageOrFrame.waitForNavigation(options);
}

enum ScraperProgressTypes {
  Initializing = 'INITIALIZING',
  StartScraping = 'START_SCRAPING',
  LoggingIn = 'LOGGING_IN',
  LoginSuccess = 'LOGIN_SUCCESS',
  LoginFailed = 'LOGIN_FAILED',
  ChangePassword = 'CHANGE_PASSWORD',
  EndScraping = 'END_SCRAPING',
  Terminating = 'TERMINATING',
}

async function waitUntilElementFound(
  page: Page | Frame,
  elementSelector: string,
  onlyVisible = false,
  timeout: number = 30_000,
) {
  await page.waitForSelector(elementSelector, { visible: onlyVisible, timeout });
}

async function fillInput(
  pageOrFrame: Page | Frame,
  inputSelector: string,
  inputValue: string,
): Promise<void> {
  await pageOrFrame.$eval(inputSelector, (input: Element) => {
    const inputElement = input;
    if ('value' in inputElement) {
      inputElement.value = '';
    }
  });
  await pageOrFrame.type(inputSelector, inputValue);
}

async function fillInputs(
  pageOrFrame: Page | Frame,
  fields: { selector: string; value: string }[],
): Promise<void> {
  const modified = [...fields];
  const input = modified.shift();

  if (!input) {
    return;
  }
  await fillInput(pageOrFrame, input.selector, input.value);
  if (modified.length) {
    await fillInputs(pageOrFrame, modified);
  }
}

async function clickButton(page: Page | Frame, buttonSelector: string) {
  await page.$eval(buttonSelector, el => (el as HTMLElement).click());
}

async function pageEvalAll<R>(
  page: Page | Frame,
  selector: string,
  defaultResult: any,
  callback: (elements: Element[], ...args: any) => R,
  ...args: any[]
): Promise<R> {
  let result = defaultResult;
  try {
    result = await page.$$eval(selector, callback, ...args);
  } catch (e) {
    // TODO temporary workaround to puppeteer@1.5.0 which breaks $$eval bevahvior until they will release a new version.
    if (!(e as Error).message.startsWith('Error: failed to find elements matching selector')) {
      throw e;
    }
  }

  return result;
}

async function pageEval<R>(
  pageOrFrame: Page | Frame,
  selector: string,
  defaultResult: any,
  callback: (elements: Element, ...args: any) => R,
  ...args: any[]
): Promise<R> {
  let result = defaultResult;
  try {
    result = await pageOrFrame.$eval(selector, callback, ...args);
  } catch (e) {
    // TODO temporary workaround to puppeteer@1.5.0 which breaks $$eval bevahvior until they will release a new version.
    if (!(e as Error).message.startsWith('Error: failed to find element matching selector')) {
      throw e;
    }
  }

  return result;
}

const SHEKEL_CURRENCY = 'ILS';

type LoginResults =
  | Exclude<
      ScraperErrorTypes,
      ScraperErrorTypes.Timeout | ScraperErrorTypes.Generic | ScraperErrorTypes.General
    >
  | LoginBaseResults;

type PossibleLoginResults = {
  [key in LoginResults]?: (
    | string
    | RegExp
    | ((options?: { page?: Page; value?: string }) => Promise<boolean>)
  )[];
};

interface LoginOptions {
  loginUrl: string;
  checkReadiness?: () => Promise<void>;
  fields: { selector: string; value: string }[];
  submitButtonSelector: string;
  preAction?: () => Promise<Frame | void>;
  postAction?: () => Promise<void>;
  possibleResults: PossibleLoginResults;
  userAgent?: string;
  waitUntil?: PuppeteerLifeCycleEvent;
}

enum LoginBaseResults {
  Success = 'SUCCESS',
  UnknownError = 'UNKNOWN_ERROR',
}

const { Timeout: _, Generic: __, General: ___, ...rest } = ScraperErrorTypes;
const LoginResults = {
  ...rest,
  ...LoginBaseResults,
};

// eslint-disable-next-line @typescript-eslint/no-redeclare

async function getKeyByValue(
  object: PossibleLoginResults,
  value: string,
  page: Page,
): Promise<LoginResults> {
  const keys = Object.keys(object);
  for (const key of keys) {
    const conditions = object[key as keyof typeof object];

    if (conditions) {
      for (const condition of conditions) {
        let result = false;

        if (condition instanceof RegExp) {
          result = condition.test(value);
        } else if (typeof condition === 'function') {
          result = await condition({ page, value });
        } else {
          result = value.toLowerCase() === condition.toLowerCase();
        }

        if (result) {
          return Promise.resolve(key) as Promise<LoginResults>;
        }
      }
    }
  }

  return Promise.resolve(LoginResults.UnknownError);
}

function createGeneralError(): ScraperScrapingResult {
  return {
    success: false,
    errorType: ScraperErrorTypes.General,
  };
}

const BASE_URL = 'https://hb2.bankleumi.co.il';
const LOGIN_URL = 'https://www.leumi.co.il/';
const TRANSACTIONS_URL = `${BASE_URL}/eBanking/SO/SPA.aspx#/ts/BusinessAccountTrx?WidgetPar=1`;
const FILTERED_TRANSACTIONS_URL = `${BASE_URL}/ChannelWCF/Broker.svc/ProcessRequest?moduleName=UC_SO_27_GetBusinessAccountTrx`;

const ACCOUNT_BLOCKED_MSG = 'המנוי חסום';
const INVALID_PASSWORD_MSG = 'אחד או יותר מפרטי ההזדהות שמסרת שגויים. ניתן לנסות שוב';

function getPossibleLoginResults() {
  const urls: LoginOptions['possibleResults'] = {
    [LoginResults.Success]: [
      /ebanking\/SO\/SPA.aspx/i,
      /^(?=.*staticcontent\/digitalfront\/)(?=.*ts=)(?=.*hrm=).*/,
    ],
    [LoginResults.InvalidPassword]: [
      async options => {
        if (!options?.page) {
          throw new Error('missing page options argument');
        }
        const errorMessage = await pageEvalAll(options.page, 'svg#Capa_1', '', element => {
          return (element[0]?.parentElement?.children[1] as HTMLDivElement)?.innerText;
        });

        return errorMessage?.startsWith(INVALID_PASSWORD_MSG);
      },
    ],
    [LoginResults.AccountBlocked]: [
      // NOTICE - might not be relevant starting the Leumi re-design during 2022 Sep
      async options => {
        if (!options?.page) {
          throw new Error('missing page options argument');
        }
        const errorMessage = await pageEvalAll(options.page, '.errHeader', '', label => {
          return (label[0] as HTMLElement)?.innerText;
        });

        return errorMessage?.startsWith(ACCOUNT_BLOCKED_MSG);
      },
    ],
    [LoginResults.ChangePassword]: ['https://hb2.bankleumi.co.il/authenticate'], // NOTICE - might not be relevant starting the Leumi re-design during 2022 Sep
  };
  return urls;
}

function createLoginFields(credentials: LeumiCredentials) {
  return [
    { selector: 'input[placeholder="שם משתמש"]', value: credentials.username },
    { selector: 'input[placeholder="סיסמה"]', value: credentials.password },
  ];
}

function extractTransactionsFromPage(
  transactions: any[],
  status: TransactionStatuses,
): Transaction[] {
  if (transactions === null || transactions.length === 0) {
    return [];
  }

  const result: Transaction[] = transactions.map(rawTransaction => {
    const date = setMilliseconds(new Date(rawTransaction.DateUTC), 0).toISOString();
    const newTransaction: Transaction = {
      status,
      type: TransactionTypes.Normal,
      date,
      processedDate: date,
      description: rawTransaction.Description || '',
      identifier: rawTransaction.ReferenceNumberLong,
      memo: rawTransaction.AdditionalData || '',
      originalCurrency: SHEKEL_CURRENCY,
      chargedAmount: rawTransaction.Amount,
      originalAmount: rawTransaction.Amount,
    };

    return newTransaction;
  });

  return result;
}

function hangProcess(timeout: number) {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

async function clickByXPath(page: Page, xpath: string): Promise<void> {
  await page.waitForSelector(xpath, { timeout: 30_000, visible: true });
  const elm = await page.$$(xpath);
  if (elm[0]) {
    await elm[0].click();
  }
}

function removeSpecialCharacters(str: string): string {
  return str.replace(/[^0-9/-]/g, '');
}

async function fetchTransactionsForAccount(
  page: Page,
  startDate: Date,
  accountId: string,
): Promise<TransactionsAccount> {
  // DEVELOPER NOTICE the account number received from the server is being altered at
  // runtime for some accounts after 1-2 seconds so we need to hang the process for a short while.
  await hangProcess(4000);

  await waitUntilElementFound(page, 'button[title="חיפוש מתקדם"]', true);
  await clickButton(page, 'button[title="חיפוש מתקדם"]');
  await waitUntilElementFound(page, 'bll-radio-button', true);
  await clickButton(page, 'bll-radio-button:not([checked])');

  await waitUntilElementFound(page, 'input[formcontrolname="txtInputFrom"]', true);

  await fillInput(page, 'input[formcontrolname="txtInputFrom"]', format(startDate, 'dd.MM.yy'));

  // we must blur the from control otherwise the search will use the previous value
  await page.focus("button[aria-label='סנן']");

  await clickButton(page, "button[aria-label='סנן']");
  const finalResponse = await page.waitForResponse(response => {
    return response.url() === FILTERED_TRANSACTIONS_URL && response.request().method() === 'POST';
  });

  const responseJson: any = await finalResponse.json();

  const accountNumber = accountId.replace('/', '_').replace(/[^\d-_]/g, '');

  const response = JSON.parse(responseJson.jsonResp);

  const pendingTransactions = response.TodayTransactionsItems;
  const transactions = response.HistoryTransactionsItems;
  const balance = response.BalanceDisplay ? parseFloat(response.BalanceDisplay) : undefined;

  const pendingTxns = extractTransactionsFromPage(pendingTransactions, TransactionStatuses.Pending);
  const completedTxns = extractTransactionsFromPage(transactions, TransactionStatuses.Completed);
  const txns = [...pendingTxns, ...completedTxns];

  return {
    accountNumber,
    balance,
    txns,
  };
}

async function fetchTransactions(page: Page, startDate: Date): Promise<TransactionsAccount[]> {
  const accounts: TransactionsAccount[] = [];

  // DEVELOPER NOTICE the account number received from the server is being altered at
  // runtime for some accounts after 1-2 seconds so we need to hang the process for a short while.
  await hangProcess(4000);

  const accountsIds = (await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('app-masked-number-combo span.display-number-li'),
      e => e.textContent,
    ),
  )) as string[];

  // due to a bug, the altered value might include undesired signs like & that should be removed

  if (!accountsIds.length) {
    throw new Error('Failed to extract or parse the account number');
  }

  for (const accountId of accountsIds) {
    if (accountsIds.length > 1) {
      // get list of accounts and check accountId
      await clickByXPath(
        page,
        'xpath///*[contains(@class, "number") and contains(@class, "combo-inner")]',
      );
      await clickByXPath(page, `xpath///span[contains(text(), '${accountId}')]`);
    }

    accounts.push(
      await fetchTransactionsForAccount(page, startDate, removeSpecialCharacters(accountId)),
    );
  }

  return accounts;
}

async function navigateToLogin(page: Page): Promise<void> {
  const loginButtonSelector = '.enter-account a[originaltitle="כניסה לחשבונך"]';
  console.log('wait for homepage to click on login button');
  await waitUntilElementFound(page, loginButtonSelector);
  console.log('navigate to login page');
  const loginUrl = await pageEval(page, loginButtonSelector, null, element => {
    return (element as any).href;
  });
  console.log(`navigating to page (${loginUrl})`);
  await page.goto(loginUrl);
  console.log('waiting for page to be loaded (networkidle2)');
  await waitForNavigation(page, { waitUntil: 'networkidle2' });
  console.log('waiting for components of login to enter credentials');
  await Promise.all([
    waitUntilElementFound(page, 'input[placeholder="שם משתמש"]', true),
    waitUntilElementFound(page, 'input[placeholder="סיסמה"]', true),
    waitUntilElementFound(page, 'button[type="submit"]', true),
  ]);
}

async function waitForPostLogin(page: Page): Promise<void> {
  await Promise.race([
    waitUntilElementFound(page, 'a[title="דלג לחשבון"]', true, 60_000),
    waitUntilElementFound(page, 'div.main-content', false, 60_000),
    waitUntilElementFound(page, '#content', false, 60_000),
    page.waitForSelector(`xpath//div[contains(string(),"${INVALID_PASSWORD_MSG}")]`),
    waitUntilElementFound(page, 'form[action="/changepassword"]', true, 60_000), // not sure if they kept this one
  ]);
}

function handleLoginResult(loginResult: LoginResults) {
  switch (loginResult) {
    case LoginResults.Success:
      console.log(ScraperProgressTypes.LoginSuccess);
      return { success: true };
    case LoginResults.InvalidPassword:
    case LoginResults.UnknownError:
      console.log(ScraperProgressTypes.LoginFailed);
      return {
        success: false,
        errorType:
          loginResult === LoginResults.InvalidPassword
            ? ScraperErrorTypes.InvalidPassword
            : ScraperErrorTypes.General,
        errorMessage: `Login failed with ${loginResult} error`,
      };
    case LoginResults.ChangePassword:
      console.log(ScraperProgressTypes.ChangePassword);
      return {
        success: false,
        errorType: ScraperErrorTypes.ChangePassword,
      };
    default:
      throw new Error(`unexpected login result "${loginResult}"`);
  }
}

function getLoginOptions(credentials: LeumiCredentials, page: Page): LoginOptions {
  return {
    loginUrl: LOGIN_URL,
    fields: createLoginFields(credentials),
    submitButtonSelector: "button[type='submit']",
    checkReadiness: async () => navigateToLogin(page),
    postAction: async () => waitForPostLogin(page),
    possibleResults: getPossibleLoginResults(),
  };
}

async function navigateTo(
  url: string,
  page?: Page,
  waitUntil: PuppeteerLifeCycleEvent | undefined = 'load',
  retries = 0,
): Promise<void> {
  const response = await page?.goto(url, { waitUntil });
  if (response === null) {
    // note: response will be null when navigating to same url while changing the hash part.
    // the condition below will always accept null as valid result.
    return;
  }

  if (!response) {
    throw new Error(`Error while trying to navigate to url ${url}, response is undefined`);
  }

  if (!response.ok()) {
    const status = response.status();
    if (retries > 0) {
      console.log(
        `Failed to navigate to url ${url}, status code: ${status}, retrying ${retries} more times`,
      );
      await navigateTo(url, page, waitUntil, retries - 1);
    } else {
      throw new Error(`Failed to navigate to url ${url}, status code: ${status}`);
    }
  }
}

async function login(credentials: LeumiCredentials, page?: Page): Promise<ScraperScrapingResult> {
  if (!credentials || !page) {
    return createGeneralError();
  }

  console.log('execute login process');
  const loginOptions = getLoginOptions(credentials, page);

  console.log('navigate to login url');
  await navigateTo(loginOptions.loginUrl, page);
  if (loginOptions.checkReadiness) {
    console.log("execute 'checkReadiness' interceptor provided in login options");
    await loginOptions.checkReadiness();
  } else if (typeof loginOptions.submitButtonSelector === 'string') {
    console.log('wait until submit button is available');
    await waitUntilElementFound(page, loginOptions.submitButtonSelector);
  }

  const loginFrameOrPage: Page | Frame | null = page;

  console.log('fill login components input with relevant values');
  await fillInputs(loginFrameOrPage, loginOptions.fields);
  console.log('click on login submit button');
  await clickButton(loginFrameOrPage, loginOptions.submitButtonSelector);
  console.log(ScraperProgressTypes.LoggingIn);

  if (loginOptions.postAction) {
    console.log("execute 'postAction' interceptor provided in login options");
    await loginOptions.postAction();
  } else {
    console.log('wait for page navigation');
    await waitForNavigation(page);
  }

  console.log('check login result');
  const current = await getCurrentUrl(page, true);
  const loginResult = await getKeyByValue(loginOptions.possibleResults, current, page);
  console.log(`handle login results ${loginResult}`);
  return handleLoginResult(loginResult);
}

async function fetchData(page: Page, startDate?: Date): Promise<ScraperScrapingResult> {
  const minimumStartMoment = addDays(subYears(new Date(), 3), 1);
  const defaultStartMoment = addDays(subYears(new Date(), 1), 1);
  const startMoment = max([minimumStartMoment, startDate || defaultStartMoment]);

  await navigateTo(TRANSACTIONS_URL, page);

  const accounts = await fetchTransactions(page, startMoment);

  return {
    success: true,
    accounts,
  };
}

async function scrape(
  page: Page,
  credentials: LeumiCredentials,
  options: LeumiOptions,
): Promise<ScraperScrapingResult> {
  let cleanups: Array<() => Promise<void>> = [];
  console.log(ScraperProgressTypes.StartScraping);
  console.log('initialize scraper');
  console.log(ScraperProgressTypes.Initializing);

  //   // initialize the browser page
  //   console.log('initialize browser page');

  //   const { timeout, showBrowser } = options;

  //   const headless = !showBrowser;
  //   console.log(`launch a browser with headless mode = ${headless}`);

  //   const browser = await puppeteer.launch({
  //     env: 'DEBUG' in process.env ? { DEBUG: '*', ...process.env } : undefined,
  //     headless,
  //     timeout,
  //   });

  //   cleanups.push(async () => {
  //     console.log('closing the browser');
  //     await browser.close();
  //   });

  //   console.log('create a new browser page');
  //   const page = await browser.newPage();

  await page.setCacheEnabled(false); // Clear cache and avoid 300's response status

  cleanups.push(() => page.close());

  if (options.defaultTimeout) {
    page.setDefaultTimeout(options.defaultTimeout);
  }

  const viewport = {
    width: 1024,
    height: 768,
  };
  console.log(`set viewport to width ${viewport.width}, height ${viewport.height}`);
  await page.setViewport(viewport);

  page.on('requestfailed', request => {
    console.log('Request failed: %s %s', request.failure()?.errorText, request.url());
  });

  let loginResult;
  try {
    loginResult = await login(credentials, page);
  } catch (e) {
    loginResult =
      e instanceof TimeoutError
        ? createTimeoutError((e as Error).message)
        : createGenericError((e as Error).message);
  }

  let scrapeResult;
  if (loginResult.success) {
    try {
      scrapeResult = await fetchData(page, options.startDate ?? new Date()); // TODO: use the furthest date possible
    } catch (e) {
      scrapeResult =
        e instanceof TimeoutError
          ? createTimeoutError((e as Error).message)
          : createGenericError((e as Error).message);
    }
  } else {
    scrapeResult = loginResult;
  }

  try {
    const success = scrapeResult && scrapeResult.success === true;

    console.log(`terminating browser with success = ${success}`);
    console.log(ScraperProgressTypes.Terminating);

    await Promise.all(cleanups.reverse().map(cleanup => cleanup()));
    cleanups = [];
  } catch (e) {
    scrapeResult = createGenericError((e as Error).message);
  }
  console.log(ScraperProgressTypes.EndScraping);

  return scrapeResult;
}

export type LeumiCredentials = { username: string; password: string };

export async function leumi(page: Page, credentials: LeumiCredentials, options?: LeumiOptions) {
  await scrape(page, credentials, { ...options });
}
