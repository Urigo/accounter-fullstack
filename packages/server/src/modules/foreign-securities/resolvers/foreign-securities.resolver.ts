import { Currency } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { formatFinancialAmount } from '../../../shared/helpers/amount.js';
import {
  dateToTimelessDateString,
  optionalDateToTimelessDateString,
} from '../../../shared/helpers/misc.js';
import {
  toSecurityPaymentType,
  toSecurityTradeType,
  toSecurityTransactionType,
} from '../helpers/security-execution-enums.helper.js';
import { ForeignSecuritiesProvider } from '../providers/foreign-securities.provider.js';
import type { ForeignSecuritiesModule, SecurityExecutionRow } from '../types.js';

/**
 * `numeric` columns arrive as decimal strings. A null column means "not applicable for this
 * kind of execution", which is not the same as zero — so it stays null rather than being
 * formatted into a `FinancialAmount` of 0.
 */
const optionalFloat = (value: string | null): number | null =>
  value == null ? null : Number(value);

/**
 * Amounts the bank quotes in the trade currency. `formatCurrency` knows the feed's Hebrew
 * currency labels; a row with no trade currency falls back to ILS, the helper's default.
 */
const tradeCurrencyAmount = (value: string | null, execution: SecurityExecutionRow) =>
  value == null ? null : formatFinancialAmount(value, execution.trade_currency);

/** The bank's NIS-suffixed columns; always ILS, never mixed. */
const ilsAmount = (value: string | null) =>
  value == null ? null : formatFinancialAmount(value, Currency.Ils);

export const foreignSecuritiesResolvers: ForeignSecuritiesModule.Resolvers = {
  ForeignSecuritiesCharge: {
    securities: async (dbCharge, _, { injector }) => {
      try {
        return await injector.get(ForeignSecuritiesProvider).getChargeSecurities(dbCharge.id);
      } catch (e) {
        throw errorSimplifier(`Error fetching securities for charge ${dbCharge.id}`, e);
      }
    },
  },
  ChargeSecurity: {
    id: chargeSecurity => chargeSecurity.id,
    securityKey: chargeSecurity => chargeSecurity.securityKey,
    details: chargeSecurity => chargeSecurity.details,
    // Transaction concrete types are mapped to their id (see codegen.ts mappers).
    transactions: chargeSecurity => chargeSecurity.transactionIds,
    executions: chargeSecurity => chargeSecurity.executions,
  },
  SecurityExecution: {
    id: execution => execution.id,
    tradeDate: execution => dateToTimelessDateString(execution.trade_date),
    valueDate: execution => optionalDateToTimelessDateString(execution.value_date),
    settlementDate: execution => optionalDateToTimelessDateString(execution.settlement_date),
    paymentDate: execution => optionalDateToTimelessDateString(execution.payment_date),
    tradeType: execution => toSecurityTradeType(execution.trade_type),
    transactionType: execution => toSecurityTransactionType(execution.transaction_type),
    // The source uses '' for "not applicable"; null is the honest representation.
    paymentType: execution => toSecurityPaymentType(execution.payment_type || null),
    quantity: execution => optionalFloat(execution.nv),
    tradePrice: execution => optionalFloat(execution.trade_price),
    tradeGrossValue: execution =>
      tradeCurrencyAmount(execution.trade_gross_value_trade_currency, execution),
    netValue: execution => tradeCurrencyAmount(execution.net_value_trade_currency, execution),
    netValueIls: execution => ilsAmount(execution.net_value_nis),
    tradeCommission: execution =>
      tradeCurrencyAmount(execution.trade_commission_value_trade_currency, execution),
    managementFees: execution =>
      tradeCurrencyAmount(execution.management_fees_value_trade_currency, execution),
    israelTaxValue: execution => ilsAmount(execution.israe_tax_value),
    nominalProfitLoss: execution => ilsAmount(execution.nominal_profit_loss_nis),
    realProfitLoss: execution => ilsAmount(execution.real_profit_loss_nis),
    symbol: execution => execution.symbol || null,
    isin: execution => execution.isin || null,
  },
  Security: {
    id: security => security.id,
    key: security => security.security_key,
    engName: security => security.eng_name,
    hebName: security => security.heb_name,
    symbol: security => security.symbol,
    engSymbol: security => security.eng_symbol,
    hebSymbol: security => security.heb_symbol,
    itemType: security => security.item_type,
    stockType: security => security.stock_type,
    // The source uses '' for "no exchange"; null is the honest representation.
    exchange: security => security.exchange || null,
    currencyCode: security => security.currency_code,
    isEtf: security => security.is_etf,
    isForeign: security => security.is_foreign,
    asOfDate: security => security.as_of_date,
  },
};
