import type { Injector } from 'graphql-modules';
import { Currency } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { formatFinancialAmount } from '../../../shared/helpers/amount.js';
import { getChargeBusinesses } from '../../charges/helpers/common.helper.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { netAmountsByCurrency } from '../helpers/securities-counterparty.helper.js';
import {
  toSecurityPaymentType,
  toSecurityTradeType,
  toSecurityTransactionType,
} from '../helpers/security-execution-enums.helper.js';
import { ForeignSecuritiesProvider } from '../providers/foreign-securities.provider.js';
import { SecurityBusinessesProvider } from '../providers/security-businesses.provider.js';
import type {
  ChargeSecurityProto,
  ForeignSecuritiesModule,
  SecurityExecutionRow,
} from '../types.js';

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

/**
 * Amounts the bank quotes in the settlement currency — the currency the cash leg moved in.
 * Falls back to the trade currency, as the ledger does when it books the same withheld tax.
 */
const settlementCurrencyAmount = (value: string | null, execution: SecurityExecutionRow) =>
  value == null
    ? null
    : formatFinancialAmount(
        value,
        execution.settlement_currency?.trim()
          ? execution.settlement_currency
          : execution.trade_currency,
      );

/** The bank's NIS-suffixed columns; always ILS, never mixed. */
const ilsAmount = (value: string | null) =>
  value == null ? null : formatFinancialAmount(value, Currency.Ils);

/**
 * The bridge from the bank's key to the security's own identity: `security_identifiers` maps
 * POALIM_SECURITY_KEY -> the ISIN-keyed security business, which is what the holdings list and
 * the executions query are addressed by. Null is a real answer — the reference feed can be
 * ingested before the executions that create a security business.
 */
const loadSecurityBusiness = async (chargeSecurity: ChargeSecurityProto, injector: Injector) =>
  (await injector.get(SecurityBusinessesProvider).getSecurityBusinessByIdentifierLoader.load({
    // Scoped to the charge's owner: the key is unique only within one, so a request whose scope
    // spans two businesses trading the same security would otherwise resolve to whichever row
    // won the batch.
    ownerId: chargeSecurity.ownerId,
    type: 'POALIM_SECURITY_KEY',
    value: chargeSecurity.securityKey,
  })) ?? null;

export const foreignSecuritiesResolvers: ForeignSecuritiesModule.Resolvers = {
  ForeignSecuritiesCharge: {
    securities: async (dbCharge, _, { injector }) => {
      try {
        const foreignSecuritiesProvider = injector.get(ForeignSecuritiesProvider);
        // executions with no cash leg (stock distributions), which the charge books directly
        const linkedExecutions = await foreignSecuritiesProvider.executionsByChargeIdLoader.load(
          dbCharge.id,
        );
        return await foreignSecuritiesProvider.getChargeSecurities(
          dbCharge.id,
          dbCharge.owner_id,
          linkedExecutions,
        );
      } catch (e) {
        throw errorSimplifier(`Error fetching securities for charge ${dbCharge.id}`, e);
      }
    },
    counterparties: async (dbCharge, _, { injector }) => {
      try {
        const { mainBusinessIds } = await getChargeBusinesses(dbCharge, injector);
        const entities = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.loadMany(mainBusinessIds);
        return entities.filter(
          (entity): entity is Exclude<typeof entity, Error | undefined | null> =>
            !!entity && !(entity instanceof Error),
        );
      } catch (e) {
        throw errorSimplifier(`Error fetching counterparties for charge ${dbCharge.id}`, e);
      }
    },
  },
  ChargeSecurity: {
    id: chargeSecurity => chargeSecurity.id,
    securityKey: chargeSecurity => chargeSecurity.securityKey,
    details: chargeSecurity => chargeSecurity.details,
    securityBusiness: (chargeSecurity, _, { injector }) =>
      loadSecurityBusiness(chargeSecurity, injector),
    // Transaction concrete types are mapped to their id (see codegen.ts mappers).
    transactions: chargeSecurity => chargeSecurity.transactionIds,
    executions: chargeSecurity => chargeSecurity.executions,
    // Both read the charge's transactions by the security's business, the same grouping the
    // charge's counterparty is narrowed by, so "offsetting" here always matches a security left
    // out of `ForeignSecuritiesCharge.counterparties`.
    netAmount: async (chargeSecurity, _, { injector }) => {
      const securityBusiness = await loadSecurityBusiness(chargeSecurity, injector);
      if (!securityBusiness) {
        return null;
      }
      const transactions = await injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(chargeSecurity.chargeId);
      const nets = netAmountsByCurrency(
        transactions.filter(transaction => transaction.business_id === securityBusiness.id),
      );
      if (nets.size !== 1) {
        return null;
      }
      const [[currency, amount]] = nets;
      return formatFinancialAmount(amount, currency);
    },
    isOffsetting: async (chargeSecurity, _, { injector }) => {
      const securityBusiness = await loadSecurityBusiness(chargeSecurity, injector);
      if (!securityBusiness) {
        return false;
      }
      const { offsettingBusinessIds } = await getChargeBusinesses(
        chargeSecurity.chargeId,
        injector,
      );
      return offsettingBusinessIds.includes(securityBusiness.id);
    },
  },
  SecurityExecution: {
    id: execution => execution.id,
    tradeDate: execution => execution.trade_date,
    valueDate: execution => execution.value_date,
    settlementDate: execution => execution.settlement_date,
    paymentDate: execution => execution.payment_date,
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
    israelTaxValue: execution => tradeCurrencyAmount(execution.israe_tax_value, execution),
    foreignTaxValue: execution =>
      settlementCurrencyAmount(execution.foreign_tax_value_settlement_currency, execution),
    israelTaxValueByPayments: execution =>
      settlementCurrencyAmount(
        execution.israel_tax_value_by_payments_settlement_currency,
        execution,
      ),
    capitalTaxValue: execution =>
      settlementCurrencyAmount(execution.capital_tax_value_settlement_currency, execution),
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
