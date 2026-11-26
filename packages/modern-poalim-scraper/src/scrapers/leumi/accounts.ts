import type { Page } from 'puppeteer';
import { callBroker, getJson, LEUMI_MOBILE_API, validate } from './broker.js';
import {
  allAccountsResponseSchema,
  getAccountsResponseSchema,
  summaryDataResponseSchema,
} from './schemas.js';

/** Every account type the site asks for on its home page. */
const ALL_ACCOUNT_TYPES =
  'CHECKING,FOREIGNACCOUNT,FOREIGNCD,FOREIGNLOAN,SECURITIES,PROVIDENTANDSTUDYFUNDS,SAVING,MORTGAGE,CREDITCARD,CD,LOAN,OTHERCREDITCARD,CASHCARD,DEBITCARD';

/**
 * The checking accounts of the signed-in user, each with the product types it holds
 * (`ClientProd`). `AccountIndex` is the handle every other call takes.
 */
export async function getAccounts(page: Page, sessionId: string, validateSchema: boolean) {
  const raw = await callBroker(page, sessionId, {
    module: 'UC_SO_GetAccounts',
    state: 'HPSummary',
    params: {
      ComboMethod: 'false',
      RequestedAccountTypes: ALL_ACCOUNT_TYPES,
      ExtAccountPermissions: 'General',
      AccountSegments: '',
    },
  });
  return validate(getAccountsResponseSchema, raw, validateSchema);
}

/**
 * Checking and foreign-currency accounts with their full (unmasked) numbers, balances and
 * currency codes. The same accounts come back several times, grouped by `requestType`.
 */
export async function getAllAccounts(page: Page, validateSchema: boolean) {
  const raw = await getJson(page, `${LEUMI_MOBILE_API}/AllAccounts/`);
  return validate(allAccountsResponseSchema, raw, validateSchema);
}

/** Totals per product type (checking, foreign currency, deposits, mortgage, securities). */
export async function getSummary(page: Page, accountIndex: number, validateSchema: boolean) {
  const raw = await getJson(page, `${LEUMI_MOBILE_API}/accounts/${accountIndex}/SummaryData`);
  return validate(summaryDataResponseSchema, raw, validateSchema);
}
