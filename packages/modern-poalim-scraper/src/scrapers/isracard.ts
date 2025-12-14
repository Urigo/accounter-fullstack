import type { Page } from 'puppeteer';
import { fetchGetWithinPage, fetchPostWithinPage } from '../utils/fetch.js';
import { userAgentOverride } from '../utils/user-agent-override.js';
import {
  IsracardCardsTransactionsListSchema,
  type IsracardCardsTransactionsList,
} from '../zod-schemas/isracard-cards-transactions-list-schema.js';
import {
  IsracardDashboardMonthSchema,
  type IsracardDashboardMonth,
} from '../zod-schemas/isracard-dashboard-month-schema.js';

const SERVICE_URL = 'https://digital.isracard.co.il/services/ProxyRequestHandler.ashx';

async function login(credentials: IsracardCredentials, page: Page) {
  const validateUrl = `${SERVICE_URL}?reqName=performLogonI`;
  const validateRequest = {
    MisparZihuy: credentials.ID,
    Sisma: credentials.password,
    cardSuffix: credentials.card6Digits,
    countryCode: '212',
    idType: '1',
  };
  return fetchPostWithinPage(page, validateUrl, validateRequest);
}

async function getMonthDashboard(page: Page, monthDate: Date, options?: IsracardOptions) {
  // get accounts data
  const billingDate = monthDate.toISOString().substr(0, 10); // get date in format YYYY-MM-DD
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const getDashboardFunction = fetchGetWithinPage<IsracardDashboardMonth>(page, accountsUrl);

  if (options?.validateSchema) {
    const data = await getDashboardFunction;
    const validation = IsracardDashboardMonthSchema.safeParse(data);
    return {
      data: validation.data,
      isValid: validation.success,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  return { data: await getDashboardFunction };
}

async function getMonthTransactions(page: Page, monthDate: Date, options?: IsracardOptions) {
  /* get transactions data */
  const monthStr = ('0' + (monthDate.getMonth() + 1)).slice(-2);
  const transUrl = `${SERVICE_URL}?reqName=CardsTransactionsList&month=${monthStr}&year=${monthDate.getFullYear()}&requiredDate=N`;
  const getTransactionsFunction = fetchGetWithinPage<IsracardCardsTransactionsList>(page, transUrl);

  if (options?.validateSchema) {
    const data = await getTransactionsFunction;
    const validation = IsracardCardsTransactionsListSchema.safeParse(data);
    return {
      data,
      isValid: validation.success,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  return { data: await getTransactionsFunction, isValid: null };
}

const getMonthsList = (options: IsracardOptions): Date[] => {
  const now = new Date();
  const monthStart = () => new Date(now.getFullYear(), now.getMonth(), 1);
  let firstMonth = new Date(
    monthStart().setMonth(monthStart().getMonth() - (options.duration ?? 30)),
  );
  const finalMonth = new Date(monthStart().setMonth(monthStart().getMonth()));
  const monthsList: Date[] = [];
  while (firstMonth <= finalMonth) {
    monthsList.push(new Date(firstMonth));
    firstMonth = new Date(firstMonth.setMonth(firstMonth.getMonth() + 1));
  }
  return monthsList;
};

export async function isracard(
  page: Page,
  credentials: IsracardCredentials,
  options: IsracardOptions = new IsracardOptions(),
) {
  await userAgentOverride(page);

  const BASE_URL = 'https://digital.isracard.co.il';
  await page.goto(`${BASE_URL}/personalarea/Login`, {
    waitUntil: 'networkidle2',
    timeout: 0,
  });

  await login(credentials, page);

  return {
    getMonthDashboard: (RequestedMonthDate: Date) =>
      getMonthDashboard(page, RequestedMonthDate, options),
    getDashboards: () =>
      Promise.all(
        /* get monthly results */
        getMonthsList(options).map(async monthDate => {
          return getMonthDashboard(page, monthDate, options);
        }),
      ),
    getMonthTransactions: (RequestedMonthDate: Date) =>
      getMonthTransactions(page, RequestedMonthDate, options),
    getTransactions: () =>
      Promise.all(
        /* get monthly results */
        getMonthsList(options).map(monthDate => getMonthTransactions(page, monthDate, options)),
      ),
  };
}

export class IsracardOptions {
  validateSchema: boolean = false;
  duration?: number;
}

export class IsracardCredentials {
  ID: string = '';
  password: string = '';
  card6Digits: string = '';
}
