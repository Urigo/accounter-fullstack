import { errorSimplifier } from '../../../shared/errors.js';
import { ForeignSecuritiesProvider } from '../providers/foreign-securities.provider.js';
import type { ForeignSecuritiesModule } from '../types.js';

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
    tradeDate: execution => execution.trade_date,
    valueDate: execution => execution.value_date,
    settlementDate: execution => execution.settlement_date,
    paymentDate: execution => execution.payment_date,
    tradeType: execution => execution.trade_type,
    transactionType: execution => execution.transaction_type,
    quantity: execution => execution.nv,
    tradePrice: execution => execution.trade_price,
    tradeGrossValueTradeCurrency: execution => execution.trade_gross_value_trade_currency,
    netValueTradeCurrency: execution => execution.net_value_trade_currency,
    netValueSettlementCurrency: execution => execution.net_value_settlement_currency,
    netValueNis: execution => execution.net_value_nis,
    // The source uses '' for "not applicable"; null is the honest representation.
    tradeCurrency: execution => execution.trade_currency || null,
    settlementCurrency: execution => execution.settlement_currency || null,
    tradeCommissionValueTradeCurrency: execution => execution.trade_commission_value_trade_currency,
    managementFeesValueTradeCurrency: execution => execution.management_fees_value_trade_currency,
    israelTaxValue: execution => execution.israe_tax_value,
    nominalProfitLossNis: execution => execution.nominal_profit_loss_nis,
    realProfitLossNis: execution => execution.real_profit_loss_nis,
    paymentType: execution => execution.payment_type || null,
    symbol: execution => execution.symbol || null,
    isin: execution => execution.isin || null,
    orderType: execution => execution.order_type || null,
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
