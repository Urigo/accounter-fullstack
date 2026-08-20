import { closeSync, openSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';
import { ReadStream, WriteStream } from 'node:tty';
import type { Page } from 'puppeteer';
import {
  captureMytradeSession,
  fetchGetWithinPage,
  fetchPoalimMytradeWithinPage,
  fetchPoalimXSRFWithinPage,
} from '../utils/fetch.js';
import {
  HapoalimAccountDataSchema,
  type HapoalimAccountData,
} from '../zod-schemas/hapoalim-account-data-schema.js';
import {
  HapoalimDepositsSchema,
  type HapoalimDeposits,
} from '../zod-schemas/hapoalim-deposits-schema.js';
import {
  HapoalimForeignDepositsSchema,
  type HapoalimForeignDeposits,
} from '../zod-schemas/hapoalim-foreign-deposits-schema.js';
import {
  HapoalimForeignTransactionsBusinessSchema,
  type HapoalimForeignTransactionsBusiness,
} from '../zod-schemas/hapoalim-foreign-transactions-business-schema.js';
import {
  HapoalimForeignTransactionsPersonalSchema,
  type HapoalimForeignTransactionsPersonal,
} from '../zod-schemas/hapoalim-foreign-transactions-personal-schema.js';
import {
  HapoalimILSTransactionsSchema,
  type HapoalimILSTransactions,
} from '../zod-schemas/hapoalim-ils-checking-transactions-schema.js';
import {
  HapoalimSecuritiesInfoSchema,
  type HapoalimSecuritiesInfo,
} from '../zod-schemas/hapoalim-securities-info-schema.js';
import {
  describeSecuritiesTransactionsError,
  HapoalimSecuritiesTransactionsSchema,
  type HapoalimSecuritiesTransactions,
} from '../zod-schemas/hapoalim-securities-transactions-schema.js';
import {
  SwiftTransactionSchema,
  type SwiftTransaction,
} from '../zod-schemas/swift-transaction-schema.js';
import {
  SwiftTransactionsSchema,
  type SwiftTransactions,
} from '../zod-schemas/swift-transactions-schema.js';
import { fetchAllExecutions } from './hapoalim-securities-paging.js';

type ForeignTransactionsSchema<T extends boolean> = T extends true
  ? HapoalimForeignTransactionsBusiness
  : T extends false
    ? HapoalimForeignTransactionsPersonal
    : never;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace window {
  const bnhpApp: {
    restContext?: string[] | string;
  };
}

/**
 * Reads a line from the user.
 *
 * `process.stdin` is only usable when the process was started with an
 * interactive stdin. Launched from an IDE run/debug console, from a wrapper
 * that pipes stdin, or with stdin redirected, nothing you type ever reaches
 * this process and the prompt hangs forever. In that case read the
 * controlling terminal (`/dev/tty`) directly instead.
 */
async function promptInput(message: string): Promise<string> {
  let input: Readable = process.stdin;
  let output: Writable = process.stdout;
  const fds: number[] = [];

  if (!process.stdin.isTTY) {
    try {
      const inFd = openSync('/dev/tty', 'r');
      const outFd = openSync('/dev/tty', 'w');
      fds.push(inFd, outFd);
      input = new ReadStream(inFd);
      output = new WriteStream(outFd);
      console.warn('stdin is not a TTY — reading the prompt from /dev/tty instead.');
    } catch {
      console.warn(
        'stdin is not a TTY and /dev/tty is unavailable. ' +
          'Run this script directly in a terminal, or pass an `otpCallback`.',
      );
    }
  }

  const rl = createInterface({ input, output, terminal: true });
  try {
    return (await rl.question(`${message} `)).trim();
  } finally {
    rl.close();
    for (const fd of fds) {
      closeSync(fd);
    }
  }
}

async function businessLogin(
  credentials: HapoalimCredentials,
  page: Page,
  otpCallback?: () => Promise<string>,
) {
  const BASE_URL = 'https://biz2.bankhapoalim.co.il/ng-portals/auth/he/biz-login/authenticate';
  await page.goto(BASE_URL);

  await page.waitForSelector('.submit-btn');

  await page.type('#user-code', credentials.userCode);
  await page.type('#password', credentials.password);

  await page.click('.submit-btn');

  // wait for the OTP screen before asking for the code, so the input is there
  // by the time we type it in
  await page.waitForSelector('input[formcontrolname="code"]', { timeout: 30_000 });

  let otp: string;
  if (otpCallback) {
    otp = await otpCallback();
  } else {
    otp = await promptInput('Enter the code you got in SMS:');
  }

  await page.type('input[formcontrolname="code"]', otp);

  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
    page.click('button.next'),
  ]);
}

async function personalLogin(credentials: HapoalimCredentials, page: Page) {
  const BASE_URL = 'https://login.bankhapoalim.co.il/ng-portals/auth/he/';
  await page.goto(BASE_URL);

  const userCode: string = credentials.userCode;
  const password: string = credentials.password;

  await page.waitForSelector('.login-btn');

  await page.type('#userCode', userCode);
  await page.type('#password', password);

  await page.click('.login-btn');

  await page.waitForNavigation();
  return 0;
}

async function replacePassword(
  previousCredentials: HapoalimCredentials,
  page: Page,
  otpCallback?: () => Promise<string>,
) {
  await page.waitForSelector('#buttonAction');

  let newPassword: string;
  if (otpCallback) {
    newPassword = await otpCallback();
  } else {
    newPassword = await promptInput('Enter your new wanted password:');
  }

  await page.type('[name="oldpassword"]', previousCredentials.password);
  await page.type('[name="newpassword"]', newPassword);
  await page.type('[name="newpassword2"]', newPassword);

  await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);

  await page.waitForSelector('#linkToHomePage');
  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
    page.click('#linkToHomePage'),
  ]);

  return 0;
}

export async function hapoalim(
  page: Page,
  credentials: HapoalimCredentials,
  options?: HapoalimOptions,
) {
  if (options?.isBusiness) {
    await businessLogin(credentials, page, options.otpCallback);
  } else {
    await personalLogin(credentials, page);
  }

  const result = await page.evaluate(() => {
    if (window?.bnhpApp?.restContext) {
      return window.bnhpApp.restContext;
    }

    return 'nothing';
  });

  // Example replace password url:
  // https://biz2.bankhapoalim.co.il/ABOUTTOEXPIRE/START?flow=ABOUTTOEXPIRE&state=START&expiredDate=11122020
  if (result === 'nothing') {
    if (page.url().search('ABOUTTOEXPIRE') === -1) {
      return 'Unknown Error';
    }

    await replacePassword(credentials, page, options?.otpCallback);
  }
  const apiSiteUrl = `https://${
    options?.isBusiness ? 'biz2' : 'login'
  }.bankhapoalim.co.il/${result.slice(1)}`;

  const now = new Date();
  const startMonth = options?.duration ?? 12;
  const startDate = new Date(now.getFullYear(), now.getMonth() - startMonth, now.getDate() + 1);
  const startDateString = startDate.toISOString().substr(0, 10).replace(/-/g, '');
  const endDateString = new Date().toISOString().substr(0, 10).replace(/-/g, '');
  // TODO: https://www.npmjs.com/package/node-fetch-cookies

  /** The mytrade API takes its date range as ddMMyyyy, unlike the yyyyMMdd used elsewhere. */
  const toMytradeDateString = (date: Date) =>
    `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`;

  /**
   * Runs a "mytrade" API call from a short-lived sibling tab.
   *
   * That API is only served to callers running on the mytrade SPA's own page, and
   * the session key it wants is minted server-side when the SPA boots — so the tab
   * has to load the SPA and the key has to be listened for before navigating (see
   * captureMytradeSession). Both securities endpoints need this, so it lives here.
   */
  async function fetchFromMytrade<TResult>(
    url: string,
    method: 'GET' | 'POST',
  ): Promise<TResult | null> {
    const tradePage = await page.browser().newPage();
    try {
      const sessionPromise = captureMytradeSession(tradePage);
      // Same origin as every other call; only the REST context is dropped, since the
      // SPA is served from the site root rather than under it.
      await tradePage.goto(`${new URL(apiSiteUrl).origin}/mytrade/app`, {
        waitUntil: 'networkidle2',
      });
      const mytradeSession = await sessionPromise;
      return await fetchPoalimMytradeWithinPage<TResult>(tradePage, url, mytradeSession, method);
    } finally {
      await tradePage.close();
    }
  }

  /**
   * mytrade signals failure in the response body rather than by status code, in two
   * shapes. Returns a human-readable message, or null when the payload looks healthy.
   */
  function describeMytradeError(data: unknown): string | null {
    const record = data as Record<string, unknown>;

    if (record['messageCode'] === 0 && record['severity'] === 'E') {
      return 'Data seems unreachable. Is the account active?';
    }

    // e.g. { Exception: { "-ExceptionType": "InvalidSessionException", Message, SessionKey } }
    const exception = record['Exception'] as Record<string, string> | undefined;
    if (exception) {
      return `Poalim mytrade error${
        exception['-ExceptionType'] ? ` (${exception['-ExceptionType']})` : ''
      }: ${exception['Message'] ?? 'unknown'}`;
    }

    return null;
  }

  return {
    getAccountsData: async (): Promise<{
      data: HapoalimAccountData | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const accountDataUrl = `${apiSiteUrl}/general/accounts`;
      const getAccountsFunction = fetchGetWithinPage<HapoalimAccountData>(page, accountDataUrl);
      if (options?.validateSchema) {
        const data = await getAccountsFunction;
        const validation = HapoalimAccountDataSchema.safeParse(data);
        return {
          data: validation.data ?? null,
          isValid: validation.success,
          errors: validation.success ? null : validation.error.issues,
        };
      }

      return { data: await getAccountsFunction, isValid: null };
    },
    getILSTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: HapoalimILSTransactions | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;
      const getIlsTransactionsFunction = fetchPoalimXSRFWithinPage<HapoalimILSTransactions>(
        page,
        ILSCheckingTransactionsUrl,
        '/current-account/transactions',
      );
      if (options?.validateSchema || options?.getTransactionsDetails) {
        const data = await getIlsTransactionsFunction;

        if (options?.getTransactionsDetails && data != null) {
          for (const transaction of data?.transactions ?? []) {
            if (transaction.pfmDetails) {
              /* let a = */ await fetchPoalimXSRFWithinPage(
                page,
                ILSCheckingTransactionsUrl,
                transaction.pfmDetails,
              );
              // TODO: create schema and make this attribute string / object for inputing data
            }
            if (transaction.details) {
              /*let b = */ await fetchPoalimXSRFWithinPage(
                page,
                ILSCheckingTransactionsUrl,
                transaction.details,
              );
              // TODO: create schema and make this attribute string / object for inputing data
            }
          }
          if (!options?.validateSchema) {
            return { data, isValid: null };
          }
        }

        if (!data) {
          console.log(`No ILS data found for account ${fullAccountNumber}`);
          return {
            data,
            isValid: true,
          };
        }
        const validation = HapoalimILSTransactionsSchema.safeParse(data);
        return {
          data: validation.data ?? null,
          isValid: validation.success,
          errors: validation.success ? null : validation.error.issues,
        };
      }

      return { data: await getIlsTransactionsFunction, isValid: null };
    },
    getForeignTransactions: async <T extends boolean>(
      account: {
        bankNumber: number;
        branchNumber: number;
        accountNumber: number;
      },
      isBusiness: T = true as T,
    ): Promise<{
      data: HapoalimForeignTransactionsBusiness | HapoalimForeignTransactionsPersonal | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      /**
       * The URL includes optional "type" query param.
       * Setting it to "business" changes the response type.
       * Since accounter uses the business-specific fields,
       * the non-business option is commented out
       *  */
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}${
        isBusiness ? '&type=business' : ''
      }&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,27,51,100,140,248&detailedAccountTypeCodeList=142&lang=he`;
      const getForeignTransactionsFunction = fetchGetWithinPage<ForeignTransactionsSchema<T>>(
        page,
        foreignTransactionsUrl,
      );
      if (options?.validateSchema) {
        const data = await getForeignTransactionsFunction;
        if (
          data &&
          (data as unknown as Record<string, unknown>)['messageCode'] === 0 &&
          (data as unknown as Record<string, unknown>)['severity'] === 'E'
        ) {
          return {
            data,
            errors: 'Data seems unreachable. Is the account active?',
            isValid: false,
          };
        }
        if (isBusiness) {
          const validation = HapoalimForeignTransactionsBusinessSchema.safeParse(data);
          return {
            data: validation.data ?? null,
            isValid: validation.success,
            errors: validation.success ? null : validation.error.issues,
          };
        }
        const validation = HapoalimForeignTransactionsPersonalSchema.safeParse(data);
        return {
          data: validation.data ?? null,
          isValid: validation.success,
          errors: validation.success ? null : validation.error.issues,
        };
      }

      return { data: await getForeignTransactionsFunction, isValid: null };
    },
    getForeignSwiftTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: SwiftTransactions | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignSwiftTransactionsUrl = `${apiSiteUrl}/foreign-trade/swiftTransactions?accountId=${fullAccountNumber}&endDate=${endDateString}&startDate=20190501`;
      const getForeignSwiftTransactionsFunction = fetchGetWithinPage<SwiftTransactions>(
        page,
        foreignSwiftTransactionsUrl,
      );
      if (options?.validateSchema) {
        const data = await getForeignSwiftTransactionsFunction;
        if (
          data &&
          (data as unknown as Record<string, unknown>)['messageCode'] === 0 &&
          (data as unknown as Record<string, unknown>)['severity'] === 'E'
        ) {
          return {
            data,
            errors: 'Data seems unreachable. Is the account active?',
            isValid: false,
          };
        }
        const validation = SwiftTransactionsSchema.safeParse(data);
        return {
          data: validation.data ?? null,
          isValid: validation.success,
          errors: validation.error,
        };
      }

      return { data: await getForeignSwiftTransactionsFunction, isValid: null };
    },
    getForeignSwiftTransaction: async (
      account: {
        bankNumber: number;
        branchNumber: number;
        accountNumber: number;
      },
      transferCatenatedId: string,
      dataOriginCode: number,
    ): Promise<{
      data: SwiftTransaction | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignSwiftTransactionUrl = `${apiSiteUrl}/foreign-trade/swiftTransactions/${transferCatenatedId}?accountId=${fullAccountNumber}&dataOriginCode=${dataOriginCode}&lang=he`;
      const getForeignSwiftTransactionFunction = fetchGetWithinPage<SwiftTransaction>(
        page,
        foreignSwiftTransactionUrl,
      );
      if (options?.validateSchema) {
        const data = await getForeignSwiftTransactionFunction;
        if (
          data &&
          (data as unknown as Record<string, unknown>)['messageCode'] === 0 &&
          (data as unknown as Record<string, unknown>)['severity'] === 'E'
        ) {
          return {
            data,
            errors: 'Data seems unreachable. Is the account active?',
            isValid: false,
          };
        }
        const validation = SwiftTransactionSchema.safeParse(data);
        return {
          data,
          isValid: validation.success,
          errors: validation.error,
        };
      }

      return { data: await getForeignSwiftTransactionFunction, isValid: null };
    },
    getDeposits: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: HapoalimDeposits | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const depositsUrl = `${apiSiteUrl}/deposits-and-savings/deposits?accountId=${fullAccountNumber}&view=details&lang=he`;
      const getDepositsFunction = fetchGetWithinPage<HapoalimDeposits>(page, depositsUrl);
      if (options?.validateSchema) {
        const data = await getDepositsFunction;
        if (!data) {
          console.log(`No deposits data found for account ${fullAccountNumber}`);
          return {
            data,
            isValid: true,
          };
        }
        const validation = HapoalimDepositsSchema.safeParse(data);
        return {
          data: validation.data ?? null,
          isValid: validation.success,
          errors: validation.success ? null : validation.error.issues,
        };
      }

      return { data: await getDepositsFunction, isValid: null };
    },
    getForeignDeposits: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: HapoalimForeignDeposits | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const depositsUrl = `${apiSiteUrl}/foreign-currency/revaluedDeposit?accountId=${fullAccountNumber}&lang=he`;
      const getDepositsFunction = fetchGetWithinPage<HapoalimForeignDeposits>(page, depositsUrl);
      if (options?.validateSchema) {
        const data = await getDepositsFunction;
        const validation = HapoalimForeignDepositsSchema.safeParse(data);
        return {
          data: validation.data ?? null,
          isValid: validation.success,
          errors: validation.success ? null : validation.error.issues,
        };
      }

      return { data: await getDepositsFunction, isValid: null };
    },
    /**
     * Static securities reference info from the "mytrade" portfolio app.
     * Live balances and open orders in the same response are ignored.
     *
     * For the activity inside the portfolio see `getSecuritiesTransactions`.
     *
     * Unlike every other Poalim endpoint this one addresses the account as
     * `branch-account` (no bank number), and is only served to callers running
     * on the mytrade SPA's own page — so the request is issued from a
     * short-lived sibling tab sharing the logged-in browser context.
     */
    getSecuritiesInfo: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: HapoalimSecuritiesInfo | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const tradeAccountNumber = `${account.branchNumber}-${account.accountNumber}`;
      const fields = [
        'EngName',
        'EngSymbol',
        'HebName',
        'HebSymbol',
        'Symbol',
        'ExpirationDate',
        'ItemType',
        'StockType',
        'IsEtf',
        'IsForeign',
        'CurrencyCode',
        'Exchange',
        'CreationEquityNum',
        'EquityType',
        'ContractType',
        'AllowedOrderDirection',
        'EquitySubType',
      ].join(',');
      const securitiesUrl = `${apiSiteUrl}/mytrade/api/v2/json2/account/view?account=${tradeAccountNumber}&fields=${fields}`;

      const data = await fetchFromMytrade<HapoalimSecuritiesInfo>(securitiesUrl, 'POST');

      if (!options?.validateSchema) {
        return { data, isValid: null };
      }

      if (!data) {
        console.log(`No securities info found for account ${tradeAccountNumber}`);
        return { data, isValid: true };
      }

      const error = describeMytradeError(data);
      if (error) {
        return { data, errors: error, isValid: false };
      }

      const validation = HapoalimSecuritiesInfoSchema.safeParse(data);
      return {
        data: validation.data ?? null,
        isValid: validation.success,
        errors: validation.success ? null : validation.error.issues,
      };
    },
    /**
     * Executed activity inside the securities portfolio — buys, sells, dividend
     * and interest payments, redemptions and other corporate actions — from the
     * "mytrade" order executions history.
     *
     * Complements `getSecuritiesInfo`, which returns the static reference info
     * for the same portfolio. Same account addressing and same sibling-tab
     * mechanics; this endpoint is a GET and takes a ddMMyyyy date range, which
     * defaults to the scraper's configured `duration` window.
     *
     * The endpoint caps a response at 150 executions and returns the most recent
     * ones, with no flag saying it truncated — so a full page is requested again
     * with the window's ceiling pulled back to the oldest day that page reached,
     * until a short page proves the window is exhausted. The pages are merged into
     * one response, deduplicated on the ceiling day the rounds share.
     */
    getSecuritiesTransactions: async (
      account: {
        bankNumber: number;
        branchNumber: number;
        accountNumber: number;
      },
      range?: { fromDate: Date; toDate: Date },
    ): Promise<{
      data: HapoalimSecuritiesTransactions | null;
      isValid: boolean | null;
      errors?: unknown;
      truncated?: string;
    }> => {
      const tradeAccountNumber = `${account.branchNumber}-${account.accountNumber}`;

      const { firstPage, failedPage, executions, truncated } =
        await fetchAllExecutions<HapoalimSecuritiesTransactions>({
          fromDate: range?.fromDate ?? startDate,
          toDate: range?.toDate ?? now,
          label: `account ${tradeAccountNumber}`,
          isErrorPage: page => describeMytradeError(page) !== null,
          // The window is the same every round — only `pageState` moves. The cursor is
          // an opaque base64 blob, so it has to be URL-encoded rather than interpolated.
          fetchPage: ({ fromDate, toDate, pageState }) =>
            fetchFromMytrade<HapoalimSecuritiesTransactions>(
              `${apiSiteUrl}/mytrade/api/v2/json2/order/executions/history?account=${tradeAccountNumber}` +
                `&fromDate=${toMytradeDateString(fromDate)}&toDate=${toMytradeDateString(toDate)}` +
                (pageState ? `&pageState=${encodeURIComponent(pageState)}` : ''),
              'GET',
            ),
        });

      // Every round answers the same shape, so the first page carries the response
      // envelope and the merged executions replace its own. Its `PageState` is the
      // round-1 cursor, long spent — the merged object is not a page, so it is nulled
      // out; `truncated` is what says whether anything was left unfetched. A page with
      // no `Account` at all — an error payload — is passed through verbatim, for the
      // error branches below to report on.
      const data =
        firstPage && 'Account' in firstPage
          ? ({
              ...firstPage,
              Account: { ...firstPage.Account, Execution: executions, PageState: null },
            } as HapoalimSecuritiesTransactions)
          : firstPage;

      if (!options?.validateSchema) {
        return { data, isValid: null, ...(truncated ? { truncated } : {}) };
      }

      if (!data) {
        console.log(`No securities transactions found for account ${tradeAccountNumber}`);
        return { data, isValid: true, ...(truncated ? { truncated } : {}) };
      }

      // A failed round is reported whichever round it was: paging only got part of
      // the window, so the merged executions must not pass as the whole of it.
      const reportedPage = failedPage ?? firstPage;
      const error = describeMytradeError(reportedPage);
      if (error) {
        return { data: reportedPage, errors: error, isValid: false };
      }

      const validation = HapoalimSecuritiesTransactionsSchema.safeParse(data);
      return {
        data: validation.data ?? null,
        isValid: validation.success,
        // Paging that stopped early is not a validation failure — the rows fetched are
        // real and ingest is idempotent, so they upload and a later run backfills.
        ...(truncated ? { truncated } : {}),
        // The schema is strict enough that a raw issue list is unreadable: it
        // points at Account.Execution.37.TradeType without saying which row that
        // is. The helper names the security and trade date per issue.
        errors: validation.success
          ? null
          : describeSecuritiesTransactionsError(data, validation.error),
      };
    },
  };
}

export class HapoalimOptions {
  validateSchema?: boolean = false;
  isBusiness?: boolean = true;
  duration?: number = 12;
  getTransactionsDetails?: boolean = false;
  otpCallback?: () => Promise<string> = undefined;
}

class HapoalimPersonalCredentials {
  userCode: string = '';
  password: string = '';
}

class HapoalimBusinessCredentials extends HapoalimPersonalCredentials {}

export type HapoalimCredentials = HapoalimPersonalCredentials | HapoalimBusinessCredentials;
