import type { Page } from 'puppeteer';
import { getJson, LEUMI_MOBILE_API, validate } from './broker.js';
import {
  mortgageDataResponseSchema,
  mortgageDetailsResponseSchema,
  mortgageLoanInfoResponseSchema,
} from './schemas.js';

/**
 * Every mortgage of the signed-in user: balance, purpose, borrowers, property address and
 * the IDs of its tracks. Not tied to one checking account.
 */
export async function getMortgages(page: Page, validateSchema: boolean) {
  const raw = await getJson(page, `${LEUMI_MOBILE_API}/mortgageDetails`);
  return validate(mortgageDetailsResponseSchema, raw, validateSchema);
}

/**
 * The tracks ("מסלולים") of one mortgage: interest type and rate, linkage, amounts, end
 * dates, and the last twelve monthly payments of the mortgage.
 *
 * `mortgageKey` is `MortgageDetail.mortgageKey` from `getMortgages`. The bank lists past
 * payments only; there is no future schedule.
 */
export async function getMortgageTracks(page: Page, mortgageKey: string, validateSchema: boolean) {
  if (!/^\d+$/.test(mortgageKey)) {
    throw new Error(`Invalid Leumi mortgage key: ${mortgageKey}`);
  }
  const raw = await getJson(page, `${LEUMI_MOBILE_API}/${mortgageKey}/loanInfo`);
  return validate(mortgageLoanInfoResponseSchema, raw, validateSchema);
}

/** Mortgage balances as the account summary shows them, with ISO dates. */
export async function getMortgageBalances(
  page: Page,
  accountIndex: number,
  validateSchema: boolean,
) {
  const raw = await getJson(page, `${LEUMI_MOBILE_API}/accounts/${accountIndex}/MortgageData`);
  return validate(mortgageDataResponseSchema, raw, validateSchema);
}
