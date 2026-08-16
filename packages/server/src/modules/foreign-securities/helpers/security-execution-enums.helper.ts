import { GraphQLError } from 'graphql';
import {
  SecurityPaymentType,
  SecurityTradeType,
  SecurityTransactionType,
} from '../../../shared/enums.js';

/**
 * `accounter_schema.poalim_securities_transactions` stores the bank's own Hebrew vocabulary
 * verbatim. These maps are the GraphQL-facing translation of the closed enums the scraper
 * already validates against — `TRADE_TYPES`, `TRANSACTION_TYPES` and `PAYMENT_TYPES` in
 * `packages/modern-poalim-scraper/src/zod-schemas/hapoalim-securities-transactions-schema.ts`.
 * Keep the two in step: a value the scraper accepts but this file does not know about would
 * reach the database and then fail to serialize.
 */

const TRADE_TYPES: Record<string, SecurityTradeType> = {
  קניה: SecurityTradeType.Buy,
  מכירה: SecurityTradeType.Sell,
  'דבידנד תשלום': SecurityTradeType.DividendPayment,
  'ריבית תשלום': SecurityTradeType.InterestPayment,
  פדיון: SecurityTradeType.Redemption,
  'הטבה חלוקת מניות': SecurityTradeType.StockDistribution,
  'העברה לזכות הפקדון': SecurityTradeType.TransferIn,
  'העברה לחובת הפקדון': SecurityTradeType.TransferOut,
  'העברה לזכות הפקדון (דו צדדית)': SecurityTradeType.TransferInTwoSided,
  'העברה לחובת הפקדון (דו צדדית)': SecurityTradeType.TransferOutTwoSided,
};

const TRANSACTION_TYPES: Record<string, SecurityTransactionType> = {
  קניה: SecurityTransactionType.Buy,
  מכירה: SecurityTransactionType.Sell,
  'תשלומים ואירועי חברה': SecurityTransactionType.PaymentsAndCorporateActions,
  העברות: SecurityTransactionType.Transfers,
};

// Note `פידיון` here against `פדיון` in TRADE_TYPES — the bank spells the same word two ways.
const PAYMENT_TYPES: Record<string, SecurityPaymentType> = {
  דיבידנד: SecurityPaymentType.Dividend,
  'דיבידנד בעין': SecurityPaymentType.DividendInKind,
  ריבית: SecurityPaymentType.Interest,
  פידיון: SecurityPaymentType.Redemption,
  פקיעה: SecurityPaymentType.Expiration,
  'איחוד מניות': SecurityPaymentType.ShareConsolidation,
  'הצעת רכש כפויה': SecurityPaymentType.CompulsoryTenderOffer,
};

function translate<T>(map: Record<string, T>, raw: string, field: string, zodConstant: string): T {
  const value = map[raw];
  if (!value) {
    // Loud rather than null: the scraper's zod schema is meant to reject unknown vocabulary
    // before it is stored, so a value landing here means the two definitions drifted apart.
    throw new GraphQLError(
      `Unknown ${field} "${raw}" on a securities execution — add it to ${zodConstant} in the scraper schema and to the matching map in security-execution-enums.helper.ts.`,
    );
  }
  return value;
}

export const toSecurityTradeType = (raw: string): SecurityTradeType =>
  translate(TRADE_TYPES, raw, 'trade type', 'TRADE_TYPES');

export const toSecurityTransactionType = (raw: string): SecurityTransactionType =>
  translate(TRANSACTION_TYPES, raw, 'transaction type', 'TRANSACTION_TYPES');

export const toSecurityPaymentType = (raw: string | null): SecurityPaymentType | null =>
  raw === null ? null : translate(PAYMENT_TYPES, raw, 'payment type', 'PAYMENT_TYPES');
