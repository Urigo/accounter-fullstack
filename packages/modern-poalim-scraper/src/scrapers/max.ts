import { addMonths, isAfter, max as maxDate, startOfMonth, subYears } from 'date-fns';
import type {
  Page,
  Frame,
  GoToOptions,
  PuppeteerLifeCycleEvent,
  WaitForOptions,
} from 'puppeteer';

enum ScraperErrorTypes {
  TwoFactorRetrieverMissing = 'TWO_FACTOR_RETRIEVER_MISSING',
  InvalidPassword = 'INVALID_PASSWORD',
  ChangePassword = 'CHANGE_PASSWORD',
  AccountBlocked = 'ACCOUNT_BLOCKED',
}

enum LoginBaseResults {
  Success = 'SUCCESS',
  UnknownError = 'UNKNOWN_ERROR',
}

const LoginResults = {
  ...ScraperErrorTypes,
  ...LoginBaseResults,
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
type LoginResults =
  | ScraperErrorTypes
  | LoginBaseResults;

enum TransactionTypes {
  Normal = 'normal',
  Installments = 'installments',
}

function isNormalTransaction(txn?: {type: TransactionTypes}): boolean {
  return !!txn && txn.type === TransactionTypes.Normal;
}

function isInstallmentTransaction(txn?: {type: TransactionTypes}): boolean {
  return !!txn && txn.type === TransactionTypes.Installments;
}

function isNonInitialInstallmentTransaction(txn: Transaction): boolean {
  return isInstallmentTransaction(txn) && !!txn.installments && txn.installments.number > 1;
}

function isInitialInstallmentTransaction(txn: Transaction): boolean {
  return isInstallmentTransaction(txn) && !!txn.installments && txn.installments.number === 1;
}

function filterOldTransactions(txns: Transaction[],
  startMoment: Date, combineInstallments: boolean) {
  return txns.filter((txn) => {
    const combineNeededAndInitialOrNormal =
      combineInstallments && (isNormalTransaction(txn) || isInitialInstallmentTransaction(txn));
    return (!combineInstallments && !isAfter(txn.date, startMoment)) ||
           (combineNeededAndInitialOrNormal && !isAfter(txn.date, startMoment));
  });
}

function fixInstallments(txns: Transaction[]): Transaction[] {
  return txns.map((txn: Transaction) => {
    const clonedTxn = { ...txn };

    if (isInstallmentTransaction(clonedTxn) && isNonInitialInstallmentTransaction(clonedTxn) &&
      clonedTxn.installments) {
      const dateMoment = new Date(clonedTxn.date);
      const actualDateMoment = addMonths(dateMoment, (clonedTxn.installments.number - 1));
      clonedTxn.date = actualDateMoment.toISOString();
    }
    return clonedTxn;
  });
}

function sortTransactionsByDate(txns: Transaction[]) {
  return txns.sort((a,b) => a.date.localeCompare(b.date));
}

async function waitForNavigation(pageOrFrame: Page | Frame, options?: WaitForOptions) {
  await pageOrFrame.waitForNavigation(options);
}

function getCurrentUrl(pageOrFrame: Page | Frame, clientSide = false) {
  if (clientSide) {
    return pageOrFrame.evaluate(() => window.location.href);
  }

  return pageOrFrame.url();
}

// type ErrorResult = {
//   success: false;
//   errorType: string;
//   errorMessage: string;
// };

// function createErrorResult(errorType: string, errorMessage: string): ErrorResult {
//   return {
//     success: false,
//     errorType,
//     errorMessage,
//   };
// }

// function createTimeoutError(errorMessage: string): ErrorResult {
//   return createErrorResult('TIMEOUT', errorMessage);
// }

// function createGenericError(errorMessage: string): ErrorResult {
//   return createErrorResult('GENERIC', errorMessage);
// }

interface TransactionsAccount {
  accountNumber: string;
  balance?: number;
  txns: Transaction[];
}

export type MaxScrapingResult = TransactionsAccount[];

// class TimeoutError extends Error {}

enum TransactionStatuses {
  Completed = 'completed',
  Pending = 'pending',
}

type PossibleLoginResults = {
  [key in LoginResults]?: (
    | string
    | RegExp
    | ((options?: { page?: Page }) => Promise<boolean>)
  )[];
};

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

interface LoginOptions {
  loginUrl: string;
  checkReadiness?: () => Promise<void>;
  fields: {
    selector: string;
    value: string; }[];
  submitButtonSelector: string | (() => Promise<void>);
  preAction?: () => Promise<Frame | void>;
  postAction?: () => Promise<void>;
  possibleResults: PossibleLoginResults;
  userAgent?: string;
  waitUntil?: PuppeteerLifeCycleEvent;
}

interface ScrapedTransaction {
  shortCardNumber: string;
  paymentDate?: string;
  purchaseDate: string;
  actualPaymentAmount: string;
  paymentCurrency: number | null;
  originalCurrency: string;
  originalAmount: number;
  planName: string;
  planTypeId: number;
  comments: string;
  merchantName: string;
  categoryId: number;
  fundsTransferComment?: string;
  fundsTransferReceiverOrTransfer?: string;
  dealData?: {
    arn: string;
  };
}

interface OutputDataOptions {
  /**
   * if true, the result wouldn't be filtered out by date, and you will return unfiltered scrapped data.
   */
  enableTransactionsFilterByDate?: boolean;
}

export interface MaxOptions {

  /**
   * the date to fetch transactions from (can't be before the minimum allowed time difference for the scraper)
   */
  startDate?: Date;

  /**
   * shows the browser while scraping, good for debugging (default false)
   */
  // showBrowser?: boolean;

  /**
   * scrape transactions to be processed X months in the future
   */
  futureMonthsToScrape?: number;

  /**
   * if set to true, all installment transactions will be combine into the first one
   */
  combineInstallments?: boolean;

  /**
   * additional arguments to pass to the browser instance. The list of flags can be found in
   *
   * https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options
   * https://peter.sh/experiments/chromium-command-line-switches/
   */
  // args?: string[];

  /**
   * adjust the browser instance before it is being used
   *
   * @param browser
   */
  // prepareBrowser?: (browser: Browser) => Promise<void>;

  /**
   * adjust the page instance before it is being used.
   *
   * @param page
   */
  // preparePage?: (page: Page) => Promise<void>;

  /**
   * Options for manipulation of output data
   */
  outputData?: OutputDataOptions;
}

const BASE_API_ACTIONS_URL = 'https://onlinelcapi.max.co.il';
const BASE_WELCOME_URL = 'https://www.max.co.il';

const LOGIN_URL = `${BASE_WELCOME_URL}/homepage/welcome`;
const PASSWORD_EXPIRED_URL = `${BASE_WELCOME_URL}/renew-password`;
const SUCCESS_URL = `${BASE_WELCOME_URL}/homepage/personal`;

enum MaxPlanName {
  Normal = 'רגילה',
  ImmediateCharge = 'חיוב עסקות מיידי',
  InternetShopping = 'אינטרנט/חו"ל',
  Installments = 'תשלומים',
  MonthlyCharge = 'חיוב חודשי',
  OneMonthPostponed = 'דחוי חודש',
  MonthlyPostponed = 'דחוי לחיוב החודשי',
  MonthlyPayment = 'תשלום חודשי',
  FuturePurchaseFinancing = 'מימון לרכישה עתידית',
  MonthlyPostponedInstallments = 'דחוי חודש תשלומים',
  ThirtyDaysPlus = 'עסקת 30 פלוס',
  TwoMonthsPostponed = 'דחוי חודשיים',
  TwoMonthsPostponed2 = 'דחוי 2 ח\' תשלומים',
  MonthlyChargePlusInterest = 'חודשי + ריבית',
  Credit = 'קרדיט',
  CreditOutsideTheLimit = 'קרדיט-מחוץ למסגרת',
  AccumulatingBasket = 'סל מצטבר',
  PostponedTransactionInstallments = 'פריסת העסקה הדחויה',
  ReplacementCard = 'כרטיס חליפי',
  EarlyRepayment = 'פרעון מוקדם',
  MonthlyCardFee = 'דמי כרטיס',
  CurrencyPocket = 'חיוב ארנק מטח',
}

const INVALID_DETAILS_SELECTOR = '#popupWrongDetails';
const LOGIN_ERROR_SELECTOR = '#popupCardHoldersLoginError';

const categories = new Map<number, string>();

async function fillInput(pageOrFrame: Page | Frame, inputSelector: string, inputValue: string): Promise<void> {
  await pageOrFrame.$eval(inputSelector, (input: Element) => {
    const inputElement = input;
    // @ts-expect-error temp description
    inputElement.value = '';
  });
  await pageOrFrame.type(inputSelector, inputValue);
}

async function clickButton(page: Page | Frame, buttonSelector: string) {
  await page.$eval(buttonSelector, (el) => (el as HTMLElement).click());
}

async function elementPresentOnPage(pageOrFrame: Page | Frame, selector: string) {
  return await pageOrFrame.$(selector) !== null;
}

async function waitUntilElementFound(
  page: Page | Frame,
  elementSelector: string,
  onlyVisible = false) {
  await page.waitForSelector(elementSelector, { visible: onlyVisible });
}

function fetchGetWithinPage<TResult>(page: Page, url: string): Promise<TResult | null> {
  return page.evaluate((innerUrl) => {
    return new Promise<TResult | null>((resolve, reject) => {
      fetch(innerUrl, {
        credentials: 'include',
      }).then((result) => {
        if (result.status === 204) {
          resolve(null);
        } else {
          resolve(result.json());
        }
      }).catch((e) => {
        reject(e);
      });
    });
  }, url);
}

function getAllMonthMoments(startMoment: Date, futureMonths?: number) {
  let monthMoment = startOfMonth(startMoment);

  const allMonths: Date[] = [];
  let lastMonth = startOfMonth(new Date());
  if (futureMonths && futureMonths > 0) {
    lastMonth = addMonths(lastMonth, futureMonths);
  }
  while (isAfter(lastMonth, monthMoment)) {
    allMonths.push(monthMoment);
    monthMoment = addMonths(monthMoment,1);
  }

  return allMonths;
}

function timeoutPromise<T>(ms: number, promise: Promise<T>, description: string): Promise<T> {
  const timeout = new Promise((__, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      // const error = new TimeoutError(description);
      reject(new Error(description));
    }, ms);
  });

  return Promise.race([
    promise,
    // casting to avoid type error- safe since this promise will always reject
    timeout as Promise<T>,
  ]);
}

/**
 * Wait until a promise resolves with a truthy value or reject after a timeout
 */
function waitUntil<T>(asyncTest: () => Promise<T>, description = '', timeout = 10_000, interval = 100) {
  const promise = new Promise<T>((resolve, reject) => {
    function wait() {
      asyncTest().then((value) => {
        if (value) {
          resolve(value);
        } else {
          setTimeout(wait, interval);
        }
      }).catch(() => {
        reject();
      });
    }
    wait();
  });
  return timeoutPromise(timeout, promise, description);
}

async function waitForRedirect(pageOrFrame: Page | Frame, timeout = 20_000,
  clientSide = false, ignoreList: string[] = []) {
  const initial = await getCurrentUrl(pageOrFrame, clientSide);

  await waitUntil(async () => {
    const current = await getCurrentUrl(pageOrFrame, clientSide);
    return current !== initial && !ignoreList.includes(current);
  }, `waiting for redirect from ${initial}`, timeout, 1000);
}

function redirectOrDialog(page: Page) {
  return Promise.race([
    waitForRedirect(page, 20_000, false, [
      BASE_WELCOME_URL,
      `${BASE_WELCOME_URL}/`,
    ]),
    waitUntilElementFound(page, INVALID_DETAILS_SELECTOR, true),
    waitUntilElementFound(page, LOGIN_ERROR_SELECTOR, true),
  ]);
}

function getTransactionsUrl(monthMoment: Date) {
  const month = monthMoment.getMonth() + 1;
  const year = monthMoment.getFullYear();
  const date = `${year}-${month}-01`;

  /**
   * url explanation:
   * userIndex: -1 for all account owners
   * cardIndex: -1 for all cards under the account
   * all other query params are static, beside the date which changes for request per month
   */
  return `${BASE_API_ACTIONS_URL}/api/registered/transactionDetails/getTransactionsAndGraphs?filterData={"userIndex":-1,"cardIndex":-1,"monthView":true,"date":"${date}","dates":{"startDate":"0","endDate":"0"},"bankAccount":{"bankAccountIndex":-1,"cards":null}}&firstCallCardIndex=-1`;
}

interface FetchCategoryResult {
  result?: Array<{
    id: number;
    name: string;
  }>;
}

async function loadCategories(page: Page) {
  console.debug('Loading categories');
  const res = await fetchGetWithinPage<FetchCategoryResult>(
    page,
    `${BASE_API_ACTIONS_URL}/api/contents/getCategories`);
  if (res && Array.isArray(res.result)) {
    console.debug(`${res.result.length} categories loaded`);
    res.result?.map(({ id, name }) => categories.set(id, name));
  }
}

function getTransactionType(planName: string, planTypeId: number) {
  const cleanedUpTxnTypeStr = planName.replace('\t', ' ').trim() as MaxPlanName;
  switch (cleanedUpTxnTypeStr) {
    case MaxPlanName.ImmediateCharge:
    case MaxPlanName.Normal:
    case MaxPlanName.MonthlyCharge:
    case MaxPlanName.OneMonthPostponed:
    case MaxPlanName.MonthlyPostponed:
    case MaxPlanName.FuturePurchaseFinancing:
    case MaxPlanName.MonthlyPayment:
    case MaxPlanName.MonthlyPostponedInstallments:
    case MaxPlanName.ThirtyDaysPlus:
    case MaxPlanName.TwoMonthsPostponed:
    case MaxPlanName.TwoMonthsPostponed2:
    case MaxPlanName.AccumulatingBasket:
    case MaxPlanName.InternetShopping:
    case MaxPlanName.MonthlyChargePlusInterest:
    case MaxPlanName.PostponedTransactionInstallments:
    case MaxPlanName.ReplacementCard:
    case MaxPlanName.EarlyRepayment:
    case MaxPlanName.MonthlyCardFee:
    case MaxPlanName.CurrencyPocket:
      return TransactionTypes.Normal;
    case MaxPlanName.Installments:
    case MaxPlanName.Credit:
    case MaxPlanName.CreditOutsideTheLimit:
      return TransactionTypes.Installments;
    default: {
      /* empty */
    }
  }
  switch (planTypeId) {
    case 2:
    case 3:
        return TransactionTypes.Installments;
    case 5:
        return TransactionTypes.Normal;
    default:
        throw new Error(
        `Unknown transaction type ${cleanedUpTxnTypeStr as string}`);
  }
}

function getInstallmentsInfo(comments: string) {
  if (!comments) {
    return undefined;
  }
  const matches = comments.match(/\d+/g);
  if (!matches || matches.length < 2) {
    return undefined;
  }

  return {
    number: parseInt(matches[0], 10),
    total: parseInt(matches[1]!, 10),
  };
}

function getChargedCurrency(currencyId: number | null) {
  switch (currencyId) {
    case 376:
      return 'ILS';
    case 840:
      return 'USD';
    case 978:
      return 'EUR';
    default:
      return undefined;
  }
}

function getMemo({
  comments,
  fundsTransferReceiverOrTransfer,
  fundsTransferComment,
}: Pick<ScrapedTransaction, 'comments' | 'fundsTransferReceiverOrTransfer' | 'fundsTransferComment'>) {
  if (fundsTransferReceiverOrTransfer) {
    const memo = comments ? `${comments} ${fundsTransferReceiverOrTransfer}` : fundsTransferReceiverOrTransfer;
    return fundsTransferComment ? `${memo}: ${fundsTransferComment}` : memo;
  }

  return comments;
}

function mapTransaction(rawTransaction: ScrapedTransaction): Transaction {
  const isPending = rawTransaction.paymentDate === null;
  const dateString = isPending ? rawTransaction.purchaseDate : rawTransaction.paymentDate
  const processedDate = (dateString ? new Date(dateString) : new Date()).toISOString();
  const status = isPending ? TransactionStatuses.Pending : TransactionStatuses.Completed;

  const installments = getInstallmentsInfo(rawTransaction.comments);
  const identifier: string | undefined = installments ? `${rawTransaction.dealData?.arn}_${installments.number}` : rawTransaction.dealData?.arn;

  return {
    type: getTransactionType(rawTransaction.planName, rawTransaction.planTypeId),
    date: new Date(rawTransaction.purchaseDate).toISOString(),
    processedDate,
    originalAmount: -rawTransaction.originalAmount,
    originalCurrency: rawTransaction.originalCurrency,
    chargedAmount: -rawTransaction.actualPaymentAmount,
    chargedCurrency: getChargedCurrency(rawTransaction.paymentCurrency),
    description: rawTransaction.merchantName.trim(),
    memo: getMemo(rawTransaction),
    category: categories.get(rawTransaction?.categoryId),
    installments,
    identifier,
    status,
  } as Transaction;
}
interface ScrapedTransactionsResult {
  result?: {
    transactions: ScrapedTransaction[];
  };
}

async function fetchTransactionsForMonth(page: Page, monthMoment: Date) {
  const url = getTransactionsUrl(monthMoment);

  const data = await fetchGetWithinPage<ScrapedTransactionsResult>(page, url);
  const transactionsByAccount: Record<string, Transaction[]> = {};

  if (!data?.result) return transactionsByAccount;

  data.result.transactions
    // Filter out non-transactions without a plan type, e.g. summary rows
    .filter((transaction) => !!transaction.planName)
    .map((transaction: ScrapedTransaction) => {
      transactionsByAccount[transaction.shortCardNumber] ||= [];

      const mappedTransaction = mapTransaction(transaction);
      transactionsByAccount[transaction.shortCardNumber]?.push(mappedTransaction);
    });

  return transactionsByAccount;
}

function addResult(allResults: Record<string, Transaction[]>, result: Record<string, Transaction[]>) {
  const clonedResults: Record<string, Transaction[]> = { ...allResults };
  Object.keys(result).map((accountNumber) => {
    clonedResults[accountNumber] ||= [];
    clonedResults[accountNumber].push(...(result[accountNumber] ?? []));
  });
  return clonedResults;
}

function prepareTransactions(
  txns: Transaction[],
  startMoment: Date,
  combineInstallments: boolean,
  enableTransactionsFilterByDate: boolean) {
  let clonedTxns = Array.from(txns);
  if (!combineInstallments) {
    clonedTxns = fixInstallments(clonedTxns);
  }
  clonedTxns = sortTransactionsByDate(clonedTxns);
  clonedTxns = enableTransactionsFilterByDate ? filterOldTransactions(
    clonedTxns,
    startMoment,
    combineInstallments || false) : clonedTxns;
  return clonedTxns;
}

function getMonthsList(startDate: Date, options: MaxOptions) {
  const futureMonthsToScrape = options.futureMonthsToScrape ?? 2;
  const allMonths = getAllMonthMoments(startDate, futureMonthsToScrape);

  return allMonths;
}

async function fetchTransactions(page: Page, options: MaxOptions) {
  const defaultStartMoment = subYears(new Date(), 4);
  const startDate = options.startDate ? maxDate([defaultStartMoment, options.startDate]) : defaultStartMoment;
  const allMonths = getMonthsList(startDate, options);

  await loadCategories(page);

  let allResults: Record<string, Transaction[]> = {};
  for (const month of allMonths) {
    const result = await fetchTransactionsForMonth(page, month);
    allResults = addResult(allResults, result);
  }

  Object.entries(allResults).map(([accountNumber, originalTxns]) => {
    let txns = originalTxns;
    txns = prepareTransactions(
      txns,
      startDate,
      options.combineInstallments || false,
      options.outputData?.enableTransactionsFilterByDate ?? true);
    allResults[accountNumber] = txns;
  });

  return allResults;
}

function getPossibleLoginResults(page: Page): PossibleLoginResults {
  const urls: PossibleLoginResults = {};
  urls[LoginResults.Success] = [SUCCESS_URL];
  urls[LoginResults.ChangePassword] = [PASSWORD_EXPIRED_URL];
  urls[LoginResults.InvalidPassword] = [
    async () => {
      return elementPresentOnPage(page, INVALID_DETAILS_SELECTOR);
    },
  ];
  urls[LoginResults.UnknownError] = [
    async () => {
      return elementPresentOnPage(page, LOGIN_ERROR_SELECTOR);
    },
  ];
  return urls;
}

function createLoginFields(credentials: MaxCredentials) {
  return [
    { selector: '#user-name', value: credentials.username },
    { selector: '#password', value: credentials.password },
  ];
}

export type MaxCredentials = {
  username: string;
  password: string;
};

// const VIEWPORT_WIDTH = 1024;
// const VIEWPORT_HEIGHT = 768;
const OK_STATUS = 200;

async function getKeyByValue(
  object: PossibleLoginResults,
  value: string,
  page: Page): Promise<LoginResults> {
  const keys = Object.keys(object);
  for (const key of keys) {
    // @ts-expect-error because we know that the key exists
    const conditions = object[key];

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
        // @ts-expect-error because we know that the key exists
        return Promise.resolve(key);
      }
    }
  }

  return Promise.resolve(LoginResults.UnknownError);
}

// function createGeneralError(): MaxScrapingResult<false> {
//   return {
//     success: false,
//     errorType: 'GENERAL_ERROR',
//   };
// }

async function fetchData(page: Page, options: MaxOptions) {
  const results = await fetchTransactions(page, options);
  const accounts = Object.entries(results).map(([accountNumber, txns]) => {
    return {
      accountNumber,
      txns,
    };
  });

  // return {
  //   success: true,
  //   accounts,
  // };
  return accounts;
}

function getLoginOptions(page: Page, credentials: MaxCredentials): LoginOptions {
  return {
    loginUrl: LOGIN_URL,
    fields: createLoginFields(credentials),
    submitButtonSelector: '#login-password #send-code',
    preAction: async () => {
      if (await elementPresentOnPage(page, '#closePopup')) {
        await clickButton(page, '#closePopup');
      }
      await clickButton(page, '.personal-area > a.go-to-personal-area');
      await waitUntilElementFound(page, '#login-password-link', true);
      await clickButton(page, '#login-password-link');
      await waitUntilElementFound(
        page,
        '#login-password.tab-pane.active app-user-login-form',
        true);
    },
    checkReadiness: async () => {
      await waitUntilElementFound(
        page,
        '.personal-area > a.go-to-personal-area',
        true);
    },
    postAction: async () => redirectOrDialog(page),
    possibleResults: getPossibleLoginResults(page),
    waitUntil: 'domcontentloaded',
  };
}

function handleLoginResult(loginResult: LoginResults): boolean {
  switch (loginResult) {
    case LoginResults.Success:
      return true;
    case LoginResults.InvalidPassword:
    case LoginResults.UnknownError:
      throw new Error(`Login failed with ${loginResult} error`);
      // return {
      //   success: false,
      //   errorType: loginResult ===
      //     LoginResults.InvalidPassword ? ScraperErrorTypes.InvalidPassword : 'GENERAL_ERROR',
      //   errorMessage: `Login failed with ${loginResult} error`,
      // };
    case LoginResults.ChangePassword:
      throw new Error('Change password');
    default:
      throw new Error(`unexpected login result "${loginResult}"`);
  }
}

async function internalFillInputs(
  pageOrFrame: Page | Frame,
  fields: { 
    selector: string;
    value: string;
  }[]): Promise<void> {
  const modified = [...fields];
  const input = modified.shift();

  if (!input) {
    return;
  }
  await fillInput(pageOrFrame, input.selector, input.value);
  if (modified.length) {
    await internalFillInputs(pageOrFrame, modified);
  }
}

async function navigateTo(
  url: string,
  page: Page,
  waitUntilA: PuppeteerLifeCycleEvent | undefined = 'load'): Promise<void> {

  const options: GoToOptions = {
    waitUntil: waitUntilA,
  };
  const response = await page.goto(url, options);

  // note: response will be null when navigating to same url while changing the hash part. the condition below will always accept null as valid result.
  if (
    response !== null &&
    (response === undefined || response.status() !== OK_STATUS)
  ) {
    throw new Error(`Error while trying to navigate to url ${url}`);
  }
}



// async function terminate(browser: Browser, success: boolean) {
//   console.debug(`terminating browser with success = ${success}`);

//   if (!browser) {
//     return;
//   }

//   await browser.close();
// }



async function login(
  page: Page,
  credentials: MaxCredentials): Promise<boolean> {
  if (!credentials || !page) {
    throw new Error('missing credentials or page');
  }

  console.debug('execute login process');
  const loginOptions = getLoginOptions(page, credentials);

  if (loginOptions.userAgent) {
    console.debug('set custom user agent provided in options');
    await page.setUserAgent(loginOptions.userAgent);
  }

  console.debug('navigate to login url');
  await navigateTo(
    loginOptions.loginUrl,
    page,
    loginOptions.waitUntil);
  if (loginOptions.checkReadiness) {
    console.debug(
      "execute 'checkReadiness' interceptor provided in login options");
    await loginOptions.checkReadiness();
  } else if (typeof loginOptions.submitButtonSelector === 'string') {
    console.debug('wait until submit button is available');
    await waitUntilElementFound(page, loginOptions.submitButtonSelector);
  }

  let loginFrameOrPage: Page | Frame | null = page;
  if (loginOptions.preAction) {
    console.debug(
      "execute 'preAction' interceptor provided in login options");
    loginFrameOrPage = (await loginOptions.preAction()) || page;
  }

  console.debug('fill login components input with relevant values');
  await internalFillInputs(loginFrameOrPage, loginOptions.fields);
  console.debug('click on login submit button');
  if (typeof loginOptions.submitButtonSelector === 'string') {
    await clickButton(loginFrameOrPage, loginOptions.submitButtonSelector);
  } else {
    await loginOptions.submitButtonSelector();
  }

  if (loginOptions.postAction) {
    console.debug(
      "execute 'postAction' interceptor provided in login options");
    await loginOptions.postAction();
  } else {
    console.debug('wait for page navigation');
    await waitForNavigation(page);
  }

  console.debug('check login result');
  const current = await getCurrentUrl(page, true);
  const loginResult = await getKeyByValue(
    loginOptions.possibleResults,
    current,
    page);
  console.debug(`handle login results ${loginResult}`);
  return handleLoginResult(loginResult);
}



// async function initialize(options: MaxOptions) {
//   // moment.tz.setDefault('Asia/Jerusalem');
//   console.debug('initialize scraper');

//   // console.debug(`launch a browser with headless mode = ${headless}`);
//   const browser = await puppeteer.launch({
//     env: { ...process.env },
//     headless: !options.showBrowser,
//     args: options.args || [],
//   });

//   if (options.prepareBrowser) {
//     console.debug("execute 'prepareBrowser' interceptor provided in options");
//     await options.prepareBrowser(browser);
//   }

//   if (!browser) {
//     console.debug('failed to initiate a browser, exit');
//     return;
//   }

//   const pages = await browser.pages();
//   let page: Page;
//   if (pages.length) {
//     console.debug('browser has already pages open, use the first one');
//     page = pages[0]!;
//   } else {
//     console.debug('create a new browser page');
//     page = await browser.newPage();
//   }

//   if (options.preparePage) {
//     console.debug("execute 'preparePage' interceptor provided in options");
//     await options.preparePage(page);
//   }

//   const viewport = {
//     width: VIEWPORT_WIDTH,
//     height: VIEWPORT_HEIGHT,
//   };
//   console.debug(
//     `set viewport to width ${viewport.width}, height ${viewport.height}`);
//   await page.setViewport({
//     width: viewport.width,
//     height: viewport.height,
//   });

//   page.on('requestfailed', (request) => {
//     console.debug(
//       'Request failed: %s %s',
//       request.failure()?.errorText,
//       request.url());
//   });

//   return {page, browser};
// }

export async function max(
  page: Page,
  credentials: MaxCredentials,
  options: MaxOptions = {}): Promise<MaxScrapingResult> {
  // const init = await initialize(options);
  // if (!init) {
  //   return createGeneralError();
  // }

  // const {page, browser} = init;

  // let loginResult;
  try {
    // loginResult = 
    await login(page, credentials);
  } catch (e) {
    console.error(e);
    throw new Error((e as Error).message);
    // loginResult =
      // e instanceof TimeoutError ? createTimeoutError((e as Error).message) : createGenericError((e as Error).message);
  }

  let scrapeResult;
  // if (loginResult.success) {
    try {
      scrapeResult = await fetchData(page, options);
    } catch (e) {
      console.error(e);
      throw new Error((e as Error).message);
      // scrapeResult =
        // e instanceof TimeoutError ?
      //     createTimeoutError((e as Error).message) : createGenericError((e as Error).message);
    }
  // } else {
  //   scrapeResult = loginResult;
  // }

  // try {
    // const success = scrapeResult && scrapeResult.success === true;
    // await terminate(browser, success);
  // } catch (e) {
  //   scrapeResult = createGenericError((e as Error).message);
  // }

  return scrapeResult;
}
