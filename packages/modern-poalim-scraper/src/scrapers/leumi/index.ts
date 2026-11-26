import type { Page } from 'puppeteer';
import { getAccounts, getAllAccounts, getSummary } from './accounts.js';
import {
  getCreditCardCycles,
  getCreditCardLines,
  getCreditCardPayback,
  getCreditCards,
  getCreditCardTotals,
  getCreditCardTransactions,
  type CardRef,
} from './credit-cards.js';
import {
  getDeposits,
  getDepositTotals,
  getMoneyMarketProducts,
  getSecuritiesProfile,
} from './deposits.js';
import {
  getForeignAccounts,
  getForeignTransactions,
  type ForeignAccountOption,
} from './foreign-transactions.js';
import { getIlsTransactions, type IlsTransactionsRange } from './ils-transactions.js';
import { attachToSignedInPage, login, type LeumiCredentials } from './login.js';
import { getMortgageBalances, getMortgages, getMortgageTracks } from './mortgages.js';

export type { LeumiCredentials } from './login.js';
export { LeumiLoginError } from './login.js';
export { LeumiRequestError, type LeumiResult } from './broker.js';
export { mapLeumiCurrencyLabel, parseLeumiAmount } from './foreign-transactions.js';
export type * from './types.js';

export type LeumiOptions = {
  /** Check every response against its schema. On by default. */
  validateSchema?: boolean;
  /**
   * The page is already signed in (someone signed in by hand in this browser): skip the
   * sign-in and read its session. `credentials` are then not used.
   */
  alreadySignedIn?: boolean;
  /** How long to wait for a person to sign in when no credentials are given. */
  manualLoginTimeoutMs?: number;
};

/**
 * Bank Leumi, personal accounts (the `/eBanking/SO/SPA.aspx` site).
 *
 * A browser is needed for the sign-in only; Leumi's sign-in runs a device and behaviour
 * check in the page that cannot be reproduced over plain HTTP. After that every call
 * here is a direct request to the bank's own JSON API, made from the signed-in page —
 * no screens are clicked through — except foreign-currency accounts, which the bank
 * still serves as a rendered page.
 *
 * Everything is read-only.
 *
 * Without `credentials` the sign-in page is opened and left for a person to complete.
 */
export async function leumi(
  page: Page,
  credentials: LeumiCredentials | undefined,
  options: LeumiOptions = {},
) {
  const validateSchema = options.validateSchema ?? true;

  const sessionId = options.alreadySignedIn
    ? await attachToSignedInPage(page)
    : await login(page, credentials, {
        ...(options.manualLoginTimeoutMs === undefined
          ? {}
          : { manualLoginTimeoutMs: options.manualLoginTimeoutMs }),
      });

  return {
    // accounts
    getAccounts: () => getAccounts(page, sessionId, validateSchema),
    getAllAccounts: () => getAllAccounts(page, validateSchema),
    getSummary: (accountIndex: number) => getSummary(page, accountIndex, validateSchema),

    // shekel checking account
    getIlsTransactions: (accountIndex: number, range: IlsTransactionsRange) =>
      getIlsTransactions(page, sessionId, accountIndex, range, validateSchema),

    // credit cards
    getCreditCards: (accountIndex: number) =>
      getCreditCards(page, sessionId, accountIndex, validateSchema),
    getCreditCardTotals: (card: CardRef) =>
      getCreditCardTotals(page, sessionId, card, validateSchema),
    getCreditCardCycles: (card: CardRef) =>
      getCreditCardCycles(page, sessionId, card, validateSchema),
    getCreditCardPayback: (card: CardRef) =>
      getCreditCardPayback(page, sessionId, card, validateSchema),
    getCreditCardTransactions: (card: CardRef, cycleDate: string) =>
      getCreditCardTransactions(page, sessionId, card, cycleDate, validateSchema),
    getCreditCardLines: (accountIndex: number) =>
      getCreditCardLines(page, accountIndex, validateSchema),

    // mortgages
    getMortgages: () => getMortgages(page, validateSchema),
    getMortgageTracks: (mortgageKey: string) =>
      getMortgageTracks(page, mortgageKey, validateSchema),
    getMortgageBalances: (accountIndex: number) =>
      getMortgageBalances(page, accountIndex, validateSchema),

    // foreign currency
    getForeignAccounts: () => getForeignAccounts(page),
    getForeignTransactions: (
      account: ForeignAccountOption,
      range: { fromDate: Date; toDate: Date },
    ) => getForeignTransactions(page, account, range, validateSchema),

    // deposits, savings, securities
    getDeposits: (accountIndex: number) => getDeposits(page, accountIndex, validateSchema),
    getDepositTotals: (accountIndex: number) =>
      getDepositTotals(page, accountIndex, validateSchema),
    getMoneyMarketProducts: (accountIndex: number) =>
      getMoneyMarketProducts(page, accountIndex, validateSchema),
    getSecuritiesProfile: () => getSecuritiesProfile(page, validateSchema),
  };
}
