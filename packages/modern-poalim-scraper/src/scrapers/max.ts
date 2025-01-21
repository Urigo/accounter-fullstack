import { addMonths, format, isAfter, max as maxDate, startOfMonth, subYears } from 'date-fns';
import type { Frame, GoToOptions, Page, PuppeteerLifeCycleEvent, WaitForOptions } from 'puppeteer';
import { fetchGetWithinPage } from '../utils/fetch.js';
import { maxCategoriesSchema } from './types/max/get-categories.js';
import {
  maxTransactionsSchema,
  type MaxTransaction,
} from './types/max/get-transactions-for-month.js';

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

type LoginResults = ScraperErrorTypes | LoginBaseResults;

enum TransactionTypes {
  Normal = 'normal',
  Installments = 'installments',
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
  TwoMonthsPostponed2 = "דחוי 2 ח' תשלומים",
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
      throw new Error(`Unknown transaction type ${cleanedUpTxnTypeStr as string}`);
  }
}

function fixInstallments(txns: MaxTransaction[]): MaxTransaction[] {
  return txns.map((txn: MaxTransaction) => {
    const clonedTxn = { ...txn };

    const type = getTransactionType(clonedTxn.planName, clonedTxn.planTypeId);
    const installments = getInstallmentsInfo(clonedTxn.comments);

    if (type === TransactionTypes.Installments && installments && installments.number > 1) {
      const date = new Date(clonedTxn.purchaseDate);
      const actualDate = addMonths(date, installments.number - 1);
      clonedTxn.purchaseDate = actualDate.toISOString();
    }
    return clonedTxn;
  });
}

function sortTransactionsByDate(txns: MaxTransaction[]) {
  return txns.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
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

interface TransactionsAccount {
  accountNumber: string;
  balance?: number;
  txns: MaxTransaction[];
}

export type MaxScrapingResult = TransactionsAccount[];

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
  fields: {
    selector: string;
    value: string;
  }[];
  submitButtonSelector: string | (() => Promise<void>);
  preAction?: () => Promise<Frame | void>;
  postAction?: () => Promise<void>;
  possibleResults: PossibleLoginResults;
  userAgent?: string;
  waitUntil?: PuppeteerLifeCycleEvent;
}

export interface MaxOptions {
  /**
   * the date to fetch transactions from (can't be before the minimum allowed time difference for the scraper)
   */
  startDate?: Date;

  /**
   * scrape transactions to be processed X months in the future
   */
  futureMonthsToScrape?: number;
}

const BASE_API_ACTIONS_URL = 'https://onlinelcapi.max.co.il';
const BASE_WELCOME_URL = 'https://www.max.co.il';

const LOGIN_URL = `${BASE_WELCOME_URL}/homepage/welcome`;
const PASSWORD_EXPIRED_URL = `${BASE_WELCOME_URL}/renew-password`;
const SUCCESS_URL = `${BASE_WELCOME_URL}/homepage/personal`;

const INVALID_DETAILS_SELECTOR = '#popupWrongDetails';
const LOGIN_ERROR_SELECTOR = '#popupCardHoldersLoginError';

const categories = new Map<number, string>();

async function fillInput(
  pageOrFrame: Page | Frame,
  inputSelector: string,
  inputValue: string,
): Promise<void> {
  await pageOrFrame.$eval(inputSelector, (input: Element) => {
    const inputElement = input;
    // @ts-expect-error force value
    inputElement.value = '';
  });
  await pageOrFrame.type(inputSelector, inputValue);
}

async function clickButton(page: Page | Frame, buttonSelector: string) {
  await page.$eval(buttonSelector, el => (el as HTMLElement).click());
}

async function elementPresentOnPage(pageOrFrame: Page | Frame, selector: string) {
  return (await pageOrFrame.$(selector)) !== null;
}

async function waitUntilElementFound(
  page: Page | Frame,
  elementSelector: string,
  onlyVisible = false,
) {
  await page.waitForSelector(elementSelector, { visible: onlyVisible });
}

function getAllMonthDates(options: MaxOptions) {
  const defaultStartDate = subYears(new Date(), 4);
  const startDate = options.startDate
    ? maxDate([defaultStartDate, options.startDate])
    : defaultStartDate;

  let monthDate = startOfMonth(startDate);

  const allMonths: Date[] = [];
  let lastMonth = startOfMonth(new Date());
  const { futureMonthsToScrape = 2 } = options;
  if (futureMonthsToScrape && futureMonthsToScrape > 0) {
    lastMonth = addMonths(lastMonth, futureMonthsToScrape);
  }
  while (isAfter(lastMonth, monthDate)) {
    allMonths.push(monthDate);
    monthDate = addMonths(monthDate, 1);
  }

  return allMonths;
}

function timeoutPromise<T>(ms: number, promise: Promise<T>, description: string): Promise<T> {
  const timeout = new Promise((__, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
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
function waitUntil<T>(
  asyncTest: () => Promise<T>,
  description = '',
  timeout = 10_000,
  interval = 100,
) {
  const promise = new Promise<T>((resolve, reject) => {
    function wait() {
      asyncTest()
        .then(value => {
          if (value) {
            resolve(value);
          } else {
            setTimeout(wait, interval);
          }
        })
        .catch(() => {
          reject();
        });
    }
    wait();
  });
  return timeoutPromise(timeout, promise, description);
}

async function waitForRedirect(
  pageOrFrame: Page | Frame,
  timeout = 20_000,
  clientSide = false,
  ignoreList: string[] = [],
) {
  const initial = await getCurrentUrl(pageOrFrame, clientSide);

  await waitUntil(
    async () => {
      const current = await getCurrentUrl(pageOrFrame, clientSide);
      return current !== initial && !ignoreList.includes(current);
    },
    `waiting for redirect from ${initial}`,
    timeout,
    1000,
  );
}

function redirectOrDialog(page: Page) {
  return Promise.race([
    waitForRedirect(page, 20_000, false, [BASE_WELCOME_URL, `${BASE_WELCOME_URL}/`]),
    waitUntilElementFound(page, INVALID_DETAILS_SELECTOR, true),
    waitUntilElementFound(page, LOGIN_ERROR_SELECTOR, true),
  ]);
}

function getTransactionsUrl(date: Date) {
  const stringDate = `${format(date, 'yyyy-MM')}-01`;

  /**
   * url explanation:
   * userIndex: -1 for all account owners
   * cardIndex: -1 for all cards under the account
   * all other query params are static, beside the date which changes for request per month
   */
  return `${BASE_API_ACTIONS_URL}/api/registered/transactionDetails/getTransactionsAndGraphs?filterData={"userIndex":-1,"cardIndex":-1,"monthView":true,"date":"${stringDate}","dates":{"startDate":"0","endDate":"0"},"bankAccount":{"bankAccountIndex":-1,"cards":null}}&firstCallCardIndex=-1`;
}

async function loadCategories(page: Page) {
  console.debug('Loading categories');
  const res = await fetchGetWithinPage(page, `${BASE_API_ACTIONS_URL}/api/contents/getCategories`);
  const parsedResponse = maxCategoriesSchema.safeParse(res);
  if (!parsedResponse.success) {
    throw new Error('Failed to parse response', parsedResponse.error);
  }
  const { result } = parsedResponse.data;
  if (result) {
    console.debug(`${result.length} categories loaded`);
    result?.map(({ id, name }) => categories.set(id, name));
  }
}

async function fetchTransactionsForMonth(page: Page, monthDate: Date) {
  const url = getTransactionsUrl(monthDate);

  const res = await fetchGetWithinPage(page, url);
  const parsedResponse = maxTransactionsSchema.safeParse(res);
  if (!parsedResponse.success) {
    console.error('failed to parse response', parsedResponse.error);
    throw new Error('Failed to parse response', parsedResponse.error);
  }

  const { result } = parsedResponse.data;
  const transactionsByAccount: Record<string, MaxTransaction[]> = {};

  if (!result) return transactionsByAccount;

  result.transactions
    // Filter out non-transactions without a plan type, e.g. summary rows
    .filter(transaction => !!transaction.planName)
    .map(transaction => {
      transactionsByAccount[transaction.shortCardNumber] ||= [];

      transactionsByAccount[transaction.shortCardNumber]?.push(transaction);
    });

  return transactionsByAccount;
}

function addResult(
  allResults: Record<string, MaxTransaction[]>,
  result: Record<string, MaxTransaction[]>,
) {
  const clonedResults: Record<string, MaxTransaction[]> = { ...allResults };
  Object.keys(result).map(accountNumber => {
    clonedResults[accountNumber] ||= [];
    clonedResults[accountNumber].push(...(result[accountNumber] ?? []));
  });
  return clonedResults;
}

function prepareTransactions(txns: MaxTransaction[]) {
  let clonedTxns = Array.from(txns);
  clonedTxns = fixInstallments(clonedTxns);
  clonedTxns = sortTransactionsByDate(clonedTxns);
  return clonedTxns;
}

async function fetchTransactions(page: Page, options: MaxOptions) {
  const allMonths = getAllMonthDates(options);

  await loadCategories(page);

  let allResults: Record<string, MaxTransaction[]> = {};
  await Promise.all(
    allMonths.map(
      async month =>
        await fetchTransactionsForMonth(page, month).then(result => {
          allResults = addResult(allResults, result);
        }),
    ),
  );

  Object.entries(allResults).map(([accountNumber, originalTxns]) => {
    let txns = originalTxns;
    txns = prepareTransactions(txns);
    allResults[accountNumber] = txns;
  });

  const accounts = Object.entries(allResults).map(([accountNumber, txns]) => {
    return {
      accountNumber,
      txns,
    };
  });

  return accounts;
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

const OK_STATUS = 200;

async function getKeyByValue(
  object: PossibleLoginResults,
  value: string,
  page: Page,
): Promise<LoginResults> {
  const keys = Object.keys(object) as LoginResults[];
  for (const key of keys) {
    const conditions = object[key];

    for (const condition of conditions ?? []) {
      let result = false;

      if (condition instanceof RegExp) {
        result = condition.test(value);
      } else if (typeof condition === 'function') {
        result = await condition({ page, value });
      } else {
        result = value.toLowerCase() === condition.toLowerCase();
      }

      if (result) {
        return Promise.resolve(key);
      }
    }
  }

  return Promise.resolve(LoginResults.UnknownError);
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
        true,
      );
    },
    checkReadiness: async () => {
      await waitUntilElementFound(page, '.personal-area > a.go-to-personal-area', true);
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
  }[],
): Promise<void> {
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
  waitUntilA: PuppeteerLifeCycleEvent | undefined = 'load',
): Promise<void> {
  const options: GoToOptions = {
    waitUntil: waitUntilA,
  };
  const response = await page.goto(url, options);

  // note: response will be null when navigating to same url while changing the hash part. the condition below will always accept null as valid result.
  if (response !== null && (response === undefined || response.status() !== OK_STATUS)) {
    throw new Error(`Error while trying to navigate to url ${url}`);
  }
}

async function login(page: Page, credentials: MaxCredentials): Promise<boolean> {
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
  await navigateTo(loginOptions.loginUrl, page, loginOptions.waitUntil);
  if (loginOptions.checkReadiness) {
    console.debug("execute 'checkReadiness' interceptor provided in login options");
    await loginOptions.checkReadiness();
  } else if (typeof loginOptions.submitButtonSelector === 'string') {
    console.debug('wait until submit button is available');
    await waitUntilElementFound(page, loginOptions.submitButtonSelector);
  }

  let loginFrameOrPage: Page | Frame | null = page;
  if (loginOptions.preAction) {
    console.debug("execute 'preAction' interceptor provided in login options");
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
    console.debug("execute 'postAction' interceptor provided in login options");
    await loginOptions.postAction();
  } else {
    console.debug('wait for page navigation');
    await waitForNavigation(page);
  }

  console.debug('check login result');
  const current = await getCurrentUrl(page, true);
  const loginResult = await getKeyByValue(loginOptions.possibleResults, current, page);
  console.debug(`handle login results ${loginResult}`);
  return handleLoginResult(loginResult);
}

export async function max(
  page: Page,
  credentials: MaxCredentials,
  options: MaxOptions = {},
): Promise<MaxScrapingResult> {
  try {
    await login(page, credentials);
  } catch (e) {
    console.error(e);
    throw new Error((e as Error).message);
  }

  try {
    return await fetchTransactions(page, options);
  } catch (e) {
    console.error(e);
    throw new Error((e as Error).message);
  }
}
