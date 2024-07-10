import inquirer from 'inquirer';
import type { Page } from 'puppeteer';
import type { AccountDataSchema } from '../__generated__/accountDataSchema.js';
import type { ForeignSwiftTransaction } from '../__generated__/foreignSwiftTransaction.js';
import type { ForeignSwiftTransactions } from '../__generated__/foreignSwiftTransactions.js';
import type { ForeignTransactionsBusinessSchema } from '../__generated__/foreignTransactionsBusinessSchema.js';
import type { ForeignTransactionsPersonalSchema } from '../__generated__/foreignTransactionsPersonalSchema.js';
import type { HapoalimDepositsSchema } from '../__generated__/hapoalimDepositsSchema.js';
import type { HapoalimForeignDepositsSchema } from '../__generated__/hapoalimForeignDepositsSchema.js';
import type { ILSCheckingTransactionsDataSchema } from '../__generated__/ILSCheckingTransactionsDataSchema.js';
import accountDataSchemaFile from '../schemas/accountDataSchema.json' with { type: 'json' };
import foreignSwiftTransactionSchema from '../schemas/foreignSwiftTransaction.json' with { type: 'json' };
import foreignSwiftTransactionsSchema from '../schemas/foreignSwiftTransactions.json' with { type: 'json' };
import foreignTransactionsBusinessSchema from '../schemas/foreignTransactionsBusinessSchema.json' with { type: 'json' };
import foreignTransactionsPersonalSchema from '../schemas/foreignTransactionsPersonalSchema.json' with { type: 'json' };
import depositsSchema from '../schemas/hapoalimDepositsSchema.json' with { type: 'json' };
import hapoalimForeignDepositsSchema from '../schemas/hapoalimForeignDepositsSchema.json' with { type: 'json' };
import ILSCheckingTransactionsDataSchemaFile from '../schemas/ILSCheckingTransactionsDataSchema.json' with { type: 'json' };
import { fetchGetWithinPage, fetchPoalimXSRFWithinPage } from '../utils/fetch.js';
import { validateSchema } from '../utils/validate-schema.js';

type ForeignTransactionsSchema<T extends boolean> = T extends true
  ? ForeignTransactionsBusinessSchema
  : T extends false
    ? ForeignTransactionsPersonalSchema
    : never;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace window {
  const bnhpApp: {
    restContext?: string[] | string;
  };
}

async function businessLogin(credentials: hapoalimCredentials, page: Page) {
  const BASE_URL = 'https://biz2.bankhapoalim.co.il/authenticate/logon/main';
  await page.goto(BASE_URL);

  await page.waitForSelector('.submit-btn');

  await page.type('#user-code', credentials.userCode);
  await page.type('#password', credentials.password);

  page.click('.submit-btn');

  const answers = await inquirer.prompt<{'SMSPassword': string}>([
    {
      type: 'input',
      name: 'SMSPassword',
      message: 'Enter the code you got in SMS:',
    },
  ]);

  await page.type('input[formcontrolname="code"]', answers.SMSPassword);

  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
    page.click('button.next'),
  ]);
}

async function personalLogin(credentials: hapoalimCredentials, page: Page) {
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

async function replacePassword(previousCredentials: hapoalimCredentials, page: Page) {
  await page.waitForSelector('#buttonAction');

  const answers = await inquirer.prompt<{'newPassword': string}>([
    {
      type: 'input',
      name: 'newPassword',
      message: 'Enter your new wanted password:',
    },
  ]);

  await page.type('[name="oldpassword"]', previousCredentials.password);
  await page.type('[name="newpassword"]', answers.newPassword);
  await page.type('[name="newpassword2"]', answers.newPassword);

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
  credentials: hapoalimCredentials,
  options?: hapoalimOptions,
) {
  if (options?.isBusiness) {
    await businessLogin(credentials, page);
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

    await replacePassword(credentials, page);
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

  return {
    getAccountsData: async (): Promise<{
      data: AccountDataSchema | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const accountDataUrl = `${apiSiteUrl}/general/accounts`;
      const getAccountsFunction = fetchGetWithinPage<AccountDataSchema>(page, accountDataUrl);
      if (options?.validateSchema) {
        const data = await getAccountsFunction;
        const validation = await validateSchema(accountDataSchemaFile, data);
        return {
          data,
          ...validation,
        };
      }

      return { data: await getAccountsFunction, isValid: null };
    },
    getILSTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: ILSCheckingTransactionsDataSchema | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;
      const getIlsTransactionsFunction =
        fetchPoalimXSRFWithinPage<ILSCheckingTransactionsDataSchema>(
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
          console.log(`No ILS data found for account ${fullAccountNumber}`)
          return {
            data,
            isValid: true,
          }
        }
        const validation = await validateSchema(ILSCheckingTransactionsDataSchemaFile, data);
        return {
          data,
          ...validation,
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
      data: ForeignTransactionsBusinessSchema | ForeignTransactionsPersonalSchema | null;
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
      }&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,27,100&detailedAccountTypeCodeList=142&lang=he`;
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
        const validation = await validateSchema(
          isBusiness ? foreignTransactionsBusinessSchema : foreignTransactionsPersonalSchema,
          data,
        );
        return {
          data,
          ...validation,
        };
      }

      return { data: await getForeignTransactionsFunction, isValid: null };
    },
    getForeignSwiftTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: ForeignSwiftTransactions | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignSwiftTransactionsUrl = `${apiSiteUrl}/foreign-trade/swiftTransactions?accountId=${fullAccountNumber}&endDate=${endDateString}&startDate=20190501`;
      const getForeignSwiftTransactionsFunction = fetchGetWithinPage<ForeignSwiftTransactions>(
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
        const validation = await validateSchema(foreignSwiftTransactionsSchema, data);
        return {
          data,
          ...validation,
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
    ): Promise<{
      data: ForeignSwiftTransaction | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignSwiftTransactionUrl = `${apiSiteUrl}/foreign-trade/swiftTransactions/${transferCatenatedId}?accountId=${fullAccountNumber}&dataOriginCode=2&lang=he`;
      const getForeignSwiftTransactionFunction = fetchGetWithinPage<ForeignSwiftTransaction>(
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
        const validation = await validateSchema(foreignSwiftTransactionSchema, data);
        return {
          data,
          ...validation,
        };
      }

      return { data: await getForeignSwiftTransactionFunction, isValid: null };
    },
    getDeposits: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: HapoalimDepositsSchema | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const depositsUrl = `${apiSiteUrl}/deposits-and-savings/deposits?accountId=${fullAccountNumber}&view=details&lang=he`;
      const getDepositsFunction = fetchGetWithinPage<HapoalimDepositsSchema>(page, depositsUrl);
      if (options?.validateSchema) {
        const data = await getDepositsFunction;
        if (!data) {
          console.log(`No deposits data found for account ${fullAccountNumber}`)
          return {
            data,
            isValid: true,
          }
        }
        const validation = await validateSchema(depositsSchema, data);
        return {
          data,
          ...validation,
        };
      }

      return { data: await getDepositsFunction, isValid: null};
    },
    getForeignDeposits: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }): Promise<{
      data: HapoalimForeignDepositsSchema | null;
      isValid: boolean | null;
      errors?: unknown;
    }> => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const depositsUrl = `${apiSiteUrl}/foreign-currency/revaluedDeposit?accountId=${fullAccountNumber}&lang=he`;
      const getDepositsFunction = fetchGetWithinPage<HapoalimForeignDepositsSchema>(
        page,
        depositsUrl,
      );
      if (options?.validateSchema) {
        const data = await getDepositsFunction;
        const validation = await validateSchema(hapoalimForeignDepositsSchema, data);
        return {
          data,
          ...validation,
        };
      }

      return { data: await getDepositsFunction, isValid: null };
    },
  };
}

export class hapoalimOptions {
  validateSchema?: boolean = false;
  isBusiness?: boolean = true;
  duration?: number = 12;
  getTransactionsDetails?: boolean = false;
}

class hapoalimPersonalCredentials {
  userCode: string = '';
  password: string = '';
}

class hapoalimBusinessCredentials extends hapoalimPersonalCredentials {}

export type hapoalimCredentials = hapoalimPersonalCredentials | hapoalimBusinessCredentials;
