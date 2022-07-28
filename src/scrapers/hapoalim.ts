import type puppeteer from 'puppeteer';
import inquirer from 'inquirer';

import { fetchPoalimXSRFWithinPage, fetchGetWithinPage } from '../utils/fetch';
import accountDataSchemaFile from '../schemas/accountDataSchema.json' assert { type: 'json' };
import ILSCheckingTransactionsDataSchemaFile from '../schemas/ILSCheckingTransactionsDataSchema.json' assert { type: 'json' };
import foreignTransactionsBusinessSchema from '../schemas/foreignTransactionsBusinessSchema.json' assert { type: 'json' };
// import foreignTransactionsPersonalSchema from '../schemas/foreignTransactionsPersonalSchema.json' assert { type: 'json' };
import depositsSchema from '../schemas/hapoalimDepositsSchema.json' assert { type: 'json' };
import type { AccountDataSchema } from '../generatedTypes/accountDataSchema';
import type { ILSCheckingTransactionsDataSchema } from '../generatedTypes/ILSCheckingTransactionsDataSchema';
import type { HapoalimDepositsSchema } from '../generatedTypes/hapoalimDepositsSchema';
import { validateSchema } from '../utils/validateSchema';
import { ForeignTransactionsBusinessSchema } from '../generatedTypes/foreignTransactionsBusinessSchema';
// import { ForeignTransactionsPersonalSchema } from '../generatedTypes/foreignTransactionsPersonalSchema';

declare namespace window {
  const bnhpApp: any;
}

async function businessLogin(
  credentials: hapoalimCredentials,
  page: puppeteer.Page
) {
  const BASE_URL = 'https://biz2.bankhapoalim.co.il/authenticate/logon/main';
  await page.goto(BASE_URL);

  await page.waitForSelector('#inputSend');

  await page.type('#userID', credentials.userCode);
  await page.type('#userPassword', credentials.password);

  page.click('#inputSend');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'SMSPassword',
      message: 'Enter the code you got in SMS:',
    },
  ]);

  await page.type('#codeForOtp', answers.SMSPassword);

  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
    page.click('#buttonNo'),
  ]);
}

async function personalLogin(
  credentials: hapoalimCredentials,
  page: puppeteer.Page
) {
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
  previousCredentials: hapoalimCredentials,
  page: puppeteer.Page
) {
  await page.waitForSelector('#buttonAction');

  const answers = await inquirer.prompt([
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
  page: puppeteer.Page,
  credentials: hapoalimCredentials,
  options?: hapoalimOptions
) {
  options?.isBusiness
    ? await businessLogin(credentials, page)
    : await personalLogin(credentials, page);

  const result = await page.evaluate(() => {
    if (window && window.bnhpApp && window.bnhpApp.restContext) {
      return window.bnhpApp.restContext;
    } else {
      return 'nothing';
    }
  });

  // Example replace password url:
  // https://biz2.bankhapoalim.co.il/ABOUTTOEXPIRE/START?flow=ABOUTTOEXPIRE&state=START&expiredDate=11122020
  if (result == 'nothing' && page.url().search('ABOUTTOEXPIRE') != -1) {
    await replacePassword(credentials, page);
  } else if (result == 'nothing') {
    return 'Unknown Error';
  }
  const apiSiteUrl = `https://${
    options?.isBusiness ? 'biz2' : 'login'
  }.bankhapoalim.co.il/${result.slice(1)}`;

  const now = new Date();
  const startMonth = options?.duration ?? 12;
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - startMonth,
    now.getDate() + 1
  );
  const startDateString = startDate
    .toISOString()
    .substr(0, 10)
    .replace(/-/g, '');
  const endDateString = new Date()
    .toISOString()
    .substr(0, 10)
    .replace(/-/g, '');
  // TODO: https://www.npmjs.com/package/node-fetch-cookies

  return {
    getAccountsData: async () => {
      const accountDataUrl = `${apiSiteUrl}/general/accounts`;
      const getAccountsFunction = fetchGetWithinPage<AccountDataSchema>(
        page,
        accountDataUrl
      );
      if (options?.validateSchema) {
        const data = await getAccountsFunction;
        const validation = await validateSchema(accountDataSchemaFile, data);
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getAccountsFunction };
      }
    },
    getILSTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;
      const getIlsTransactionsFunction =
        fetchPoalimXSRFWithinPage<ILSCheckingTransactionsDataSchema>(
          page,
          ILSCheckingTransactionsUrl,
          '/current-account/transactions'
        );
      if (options?.validateSchema || options?.getTransactionsDetails) {
        const data = await getIlsTransactionsFunction;

        if (options?.getTransactionsDetails && data != null) {
          for (let transaction of data?.transactions) {
            if (!!transaction.pfmDetails) {
              /* let a = */ await fetchPoalimXSRFWithinPage(
                page,
                ILSCheckingTransactionsUrl,
                transaction.pfmDetails
              );
              // TODO: create schema and make this attribute string / object for inputing data
            }
            if (!!transaction.details) {
              /*let b = */ await fetchPoalimXSRFWithinPage(
                page,
                ILSCheckingTransactionsUrl,
                transaction.details
              );
              // TODO: create schema and make this attribute string / object for inputing data
            }
          }
          if (!options?.validateSchema) {
            return { data };
          }
        }

        const validation = await validateSchema(
          ILSCheckingTransactionsDataSchemaFile,
          data
        );
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getIlsTransactionsFunction };
      }
    },
    getForeignTransactions: async (
      account: {
        bankNumber: number;
        branchNumber: number;
        accountNumber: number;
      }
      // isBusiness = true
    ) => {
      /**
       * The URL includes optional "type" query param.
       * Setting itto "business" changes the response type.
       * Since accounter uses the business-specific fields,
       * the non-business option is commented out
       *  */
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      // ${isBusiness ? 'type=business&' : ''}
      const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,27,100&detailedAccountTypeCodeList=142&lang=he`;
      const getForeignTransactionsFunction =
        fetchGetWithinPage<ForeignTransactionsBusinessSchema>(
          //  | ForeignTransactionsPersonalSchema
          page,
          foreignTransactionsUrl
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
          // isBusiness
          //   ? foreignTransactionsBusinessSchema
          //   : foreignTransactionsPersonalSchema,
          foreignTransactionsBusinessSchema,
          data
        );
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getForeignTransactionsFunction };
      }
    },
    getDeposits: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const depositsUrl = `${apiSiteUrl}/deposits-and-savings/deposits?accountId=${fullAccountNumber}&view=details&lang=he`;
      const getDepositsFunction = fetchGetWithinPage<HapoalimDepositsSchema>(
        page,
        depositsUrl
      );
      if (options?.validateSchema) {
        const data = await getDepositsFunction;
        const validation = await validateSchema(depositsSchema, data);
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getDepositsFunction };
      }
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

export type hapoalimCredentials =
  | hapoalimPersonalCredentials
  | hapoalimBusinessCredentials;
