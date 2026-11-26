import type { Page } from 'puppeteer';
import { callBroker, getJson, LEUMI_MOBILE_API, validate } from './broker.js';
import {
  creditCardDetailsResponseSchema,
  creditCardLinesResponseSchema,
  creditCardsInfoResponseSchema,
} from './schemas.js';

/**
 * `Operation` of `UC_MS_125_CreditCardsInfo`. One module serves every tab of the cards
 * screen; each operation fills a different part of the same response and leaves the rest
 * `null`.
 */
const CARD_OPERATION = {
  /** `TotalPayment`: balances, credit frame, currency. */
  totals: 1,
  /** `Graph`: recent debit sums and the list of billing cycles (`DebitMonthItems`). */
  cycles: 2,
  /** `Activity`: the transactions of one billing cycle. */
  activity: 3,
  /** `PayBack`: early-repayment terms. */
  payback: 4,
} as const;

/** `CardPeriodType` for "the cycle named by `CycleDate`". */
const PERIOD_BY_CYCLE_DATE = 99;

/**
 * Cards attached to a checking account. `CreditCardsItems` are bank-issued cards;
 * `OtherCreditCardsItems` are cards of other issuers that only debit this account, for
 * which the bank has totals but no transactions.
 */
export async function getCreditCards(
  page: Page,
  sessionId: string,
  accountIndex: number,
  validateSchema: boolean,
) {
  const raw = await callBroker(page, sessionId, {
    module: 'UC_SO_GetCreditCardsInfo',
    state: 'CardsWorld',
    params: { AccountIndex: accountIndex },
  });
  return validate(creditCardsInfoResponseSchema, raw, validateSchema);
}

async function getCardDetails(
  page: Page,
  sessionId: string,
  card: CardRef,
  operation: number,
  extra: Record<string, unknown>,
  validateSchema: boolean,
) {
  const raw = await callBroker(page, sessionId, {
    module: 'UC_MS_125_CreditCardsInfo',
    state: 'CardsWorld',
    params: {
      AccountIndexSpecified: true,
      CardIndex: card.cardIndex,
      Operation: operation,
      OperationSpecified: true,
      AccountIndex: card.accountIndex,
      ...extra,
    },
  });
  return validate(creditCardDetailsResponseSchema, raw, validateSchema);
}

export type CardRef = {
  accountIndex: number;
  /** `CardIndex` from `getCreditCards`. */
  cardIndex: number;
};

export function getCreditCardTotals(
  page: Page,
  sessionId: string,
  card: CardRef,
  validateSchema: boolean,
) {
  return getCardDetails(page, sessionId, card, CARD_OPERATION.totals, {}, validateSchema);
}

/** The billing cycles the bank offers for a card, in `Graph.DebitMonthItems[].CycleDate`. */
export function getCreditCardCycles(
  page: Page,
  sessionId: string,
  card: CardRef,
  validateSchema: boolean,
) {
  return getCardDetails(page, sessionId, card, CARD_OPERATION.cycles, {}, validateSchema);
}

export function getCreditCardPayback(
  page: Page,
  sessionId: string,
  card: CardRef,
  validateSchema: boolean,
) {
  return getCardDetails(page, sessionId, card, CARD_OPERATION.payback, {}, validateSchema);
}

/**
 * Transactions of one billing cycle.
 *
 * `cycleDate` is a `CycleDate` as the bank lists it (`2026-11-01T00:00:00`, the first of
 * the month the cycle is debited in). Cycles older than the listed ones still answer.
 *
 * A cycle with nothing in it comes back as `SOStatus.Status: false` with `Activity: null`
 * ("faild to create Activity or no data"), not as an empty list — the bank does not tell
 * "empty" from "failed" here.
 */
export function getCreditCardTransactions(
  page: Page,
  sessionId: string,
  card: CardRef,
  cycleDate: string,
  validateSchema: boolean,
) {
  return getCardDetails(
    page,
    sessionId,
    card,
    CARD_OPERATION.activity,
    {
      CardPeriodType: PERIOD_BY_CYCLE_DATE,
      CardPeriodTypeSpecified: true,
      CycleDate: cycleDate,
    },
    validateSchema,
  );
}

/** Credit frames and usage of every card on the account. */
export async function getCreditCardLines(
  page: Page,
  accountIndex: number,
  validateSchema: boolean,
) {
  const raw = await getJson(
    page,
    `${LEUMI_MOBILE_API}/accounts/${accountIndex}/CreditCardLines?cardIndex=`,
  );
  return validate(creditCardLinesResponseSchema, raw, validateSchema);
}
