import type { Page } from 'puppeteer';
import { z } from 'zod';
import { getJson, LEUMI_BASE_URL, LEUMI_MOBILE_API, validate } from './broker.js';
import {
  marketProductDetailsResponseSchema,
  savingCdDataResponseSchema,
  tradeConfigResponseSchema,
} from './schemas.js';

/**
 * Deposits and savings ("פיקדונות וחסכונות").
 *
 * UNVERIFIED SHAPE: no account these schemas were written against holds a deposit — the
 * endpoint answered `204 No Content`. The fields below are the ones the open-source
 * `israeli-bank-scrapers` project documents for this endpoint, kept non-strict
 * (`looseObject`) so an account that does have deposits is not rejected over fields
 * nobody has seen yet. Tighten it from the first real response.
 */
export const depositsResponseSchema = z.looseObject({
  totalDepositsAndSavingsBalance: z.number(),
  previousBusinessDayDate: z.string(),
  depositsAndSavingsItems: z.array(
    z.looseObject({
      depositId: z.string(),
      displayName: z.string(),
      productName: z.string(),
      currentBalance: z.number(),
      depositNumber: z.string(),
      relatedAccountNumber: z.string(),
    }),
  ),
});

/** `data` is `null` when the account has no deposits or savings. */
export async function getDeposits(page: Page, accountIndex: number, validateSchema: boolean) {
  const raw = await getJson(
    page,
    `${LEUMI_MOBILE_API}/accounts/${accountIndex}/Deposits?operationList=true`,
  );
  return validate(depositsResponseSchema.nullable(), raw, validateSchema);
}

/** Totals of shekel and foreign-currency deposits; every field is `null` without any. */
export async function getDepositTotals(page: Page, accountIndex: number, validateSchema: boolean) {
  const raw = await getJson(page, `${LEUMI_MOBILE_API}/accounts/${accountIndex}/SavingCdData`);
  return validate(savingCdDataResponseSchema, raw, validateSchema);
}

/** Money-market products: deposits, money-market funds and government bonds held. */
export async function getMoneyMarketProducts(
  page: Page,
  accountIndex: number,
  validateSchema: boolean,
) {
  const raw = await getJson(
    page,
    `${LEUMI_MOBILE_API}/accounts/${accountIndex}/MarketProductDetails/`,
  );
  return validate(marketProductDetailsResponseSchema, raw, validateSchema);
}

/**
 * The securities ("Leumi Trade") profile of the user. `data.user.Portfolios` lists the
 * portfolios; it is empty for a user without one.
 *
 * Holdings and orders of a portfolio are not read: no account at hand has a portfolio to
 * write and check a schema against.
 */
export async function getSecuritiesProfile(page: Page, validateSchema: boolean) {
  const raw = await getJson(page, '/lti/lti-app/api/config');
  return validate(tradeConfigResponseSchema, raw, validateSchema);
}

export const LEUMI_TRADE_URL = `${LEUMI_BASE_URL}/lti/lti-app/home`;
