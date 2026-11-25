import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { Currency } from '../../../shared/enums.js';
import { dateToTimelessDateString, roundToAgorot } from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import {
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import type { IGetDepreciationRecordsByIdsResult } from '../types.js';
import type { CostRefundMode } from './asset-depreciation.helper.js';

export type AssetLocalCostSource =
  /** `local_amount` is set and wins */
  | 'OVERRIDE'
  /** the amount is already in the local currency */
  | 'LOCAL'
  /** the amount is in a foreign currency, converted at the purchase date's rate */
  | 'CONVERTED'
  /** the record has no amount */
  | 'MISSING';

export type AssetLocalCost = {
  /** the asset's cost basis in the local currency, or null when the record has no amount */
  cost: number | null;
  /** the rate a foreign-currency amount was converted at */
  rate: number | null;
  /** the date of that rate */
  rateDate: TimelessDateString | null;
  source: AssetLocalCostSource;
};

export type AssetCostRecord = Pick<
  IGetDepreciationRecordsByIdsResult,
  'id' | 'amount' | 'currency' | 'local_amount' | 'charge_id' | 'activation_date'
>;

/**
 * The earliest date of a charge's misc expenses: their earliest invoice date, else their earliest
 * value date; null when the charge has none
 */
export async function getChargeMiscExpensesMinDate(
  injector: Injector,
  chargeId: string,
): Promise<TimelessDateString | null> {
  const expenses = await injector
    .get(MiscExpensesProvider)
    .getExpensesByChargeIdLoader.load(chargeId);
  let minInvoiceDate: TimelessDateString | null = null;
  let minValueDate: TimelessDateString | null = null;
  for (const expense of expenses) {
    if (expense.invoice_date && (!minInvoiceDate || expense.invoice_date < minInvoiceDate)) {
      minInvoiceDate = expense.invoice_date;
    }
    if (expense.value_date) {
      const valueDate = dateToTimelessDateString(expense.value_date);
      if (!minValueDate || valueDate < minValueDate) {
        minValueDate = valueDate;
      }
    }
  }
  return minInvoiceDate ?? minValueDate;
}

/**
 * The date a foreign-currency asset is converted at (the contract date): the purchase charge's
 * (earliest) document date, falling back to its misc expenses (an acquisition entered without
 * documents), then to its first payment date, then to the asset's activation date
 */
export async function getAssetRateDate(
  injector: Injector,
  record: Pick<AssetCostRecord, 'charge_id' | 'activation_date'>,
): Promise<TimelessDateString> {
  const { documentsMinDate } = await getChargeDocumentsMeta(record.charge_id, injector);
  if (documentsMinDate) {
    return documentsMinDate;
  }
  const miscExpensesMinDate = await getChargeMiscExpensesMinDate(injector, record.charge_id);
  if (miscExpensesMinDate) {
    return miscExpensesMinDate;
  }
  const { transactionsMinDebitDate } = await getChargeTransactionsMeta(record.charge_id, injector);
  return transactionsMinDebitDate ?? record.activation_date;
}

async function computeAssetLocalCost(
  injector: Injector,
  record: AssetCostRecord,
): Promise<AssetLocalCost> {
  if (record.local_amount != null) {
    return { cost: Number(record.local_amount), rate: null, rateDate: null, source: 'OVERRIDE' };
  }
  if (record.amount == null) {
    return { cost: null, rate: null, rateDate: null, source: 'MISSING' };
  }
  const amount = Number(record.amount);
  if (!record.currency) {
    return { cost: amount, rate: null, rateDate: null, source: 'LOCAL' };
  }
  const { defaultLocalCurrency } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();
  if (record.currency === defaultLocalCurrency) {
    return { cost: amount, rate: null, rateDate: null, source: 'LOCAL' };
  }

  const rateDate = await getAssetRateDate(injector, record);
  let rate: number;
  try {
    rate = await injector
      .get(ExchangeProvider)
      .getExchangeRates(record.currency as Currency, defaultLocalCurrency, rateDate);
  } catch (error) {
    console.error(error);
    throw new GraphQLError(
      `Unable to convert depreciation record ${record.id} from ${record.currency} to ${defaultLocalCurrency} at ${rateDate}; set its local cost instead`,
    );
  }
  return { cost: amount * rate, rate, rateDate, source: 'CONVERTED' };
}

/** Per operation (injector) and loaded record, so a record's field resolvers share one lookup */
const cache = new WeakMap<Injector, WeakMap<AssetCostRecord, Promise<AssetLocalCost>>>();

/**
 * An asset's cost basis in the local currency. The local cost override wins; a local-currency
 * amount is taken as is; a foreign-currency amount is converted at the Bank of Israel rate of the
 * purchase date (see `getAssetRateDate`), the IAS 21 historical rate.
 */
export function resolveAssetLocalCost(
  injector: Injector,
  record: AssetCostRecord,
): Promise<AssetLocalCost> {
  let perInjector = cache.get(injector);
  if (!perInjector) {
    perInjector = new WeakMap();
    cache.set(injector, perInjector);
  }
  let result = perInjector.get(record);
  if (!result) {
    result = computeAssetLocalCost(injector, record);
    perInjector.set(record, result);
    // a failed lookup isn't remembered
    result.catch(() => perInjector?.delete(record));
  }
  return result;
}

export type RefundConversion = {
  /**
   * the refund in the local currency: whole shekels for a refund from activation (see
   * `convertForeignRefunds`), rounded to agorot for a refund from the refund date
   */
  cost: number;
  /** local currency per unit of the asset's currency */
  rate: number;
  /** the date of that rate; null for an asset whose local cost is overridden */
  rateDate: TimelessDateString | null;
};

/** A cost refund entered in the currency of a foreign-currency asset */
export type ForeignRefund = {
  id: string;
  originalAmount: number;
  refundMode: CostRefundMode;
  chargeId?: string | null;
  refundDate: TimelessDateString;
};

function byRefundDateThenId(a: ForeignRefund, b: ForeignRefund): number {
  if (a.refundDate !== b.refundDate) {
    return a.refundDate < b.refundDate ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

/**
 * Converts an asset's cost refunds entered in its currency to the local currency, by id:
 * - `FROM_ACTIVATION` corrects the original price, so it converts at the asset's cost-basis rate
 *   (local cost ÷ amount): the purchase date's rate, or the rate implied by a local cost override.
 *   These refunds are allocated cumulatively in whole shekels, in date then id order: each takes
 *   round(refunded so far × cost ÷ amount) less what the earlier ones took. Refunds of the whole
 *   amount, however split, then add up to exactly the asset's (whole-shekel) cost.
 * - `FROM_REFUND_DATE` is a later rebate, a receivable arising on the refund date: it converts at
 *   the refund charge's rate (its earliest document date, else the refund date), rounded to agorot.
 *
 * Pass all of the asset's refunds entered in its currency, so the allocation sees the earlier ones.
 */
export async function convertForeignRefunds(
  injector: Injector,
  record: AssetCostRecord,
  refunds: readonly ForeignRefund[],
): Promise<Map<string, RefundConversion>> {
  const conversions = new Map<string, RefundConversion>();

  const fromActivation = refunds
    .filter(refund => refund.refundMode === 'FROM_ACTIVATION')
    .sort(byRefundDateThenId);
  if (fromActivation.length > 0) {
    const assetCost = await resolveAssetLocalCost(injector, record);
    const amount = record.amount == null ? null : Number(record.amount);
    if (assetCost.cost == null || !amount) {
      throw new GraphQLError(
        `Depreciation record ${record.id} has no amount to convert its cost refunds by`,
      );
    }
    // the engine depreciates the cost in whole shekels
    const cost = Math.round(assetCost.cost);
    const rate = assetCost.cost / amount;
    let refunded = 0;
    let allocated = 0;
    for (const refund of fromActivation) {
      refunded = roundToAgorot(refunded + refund.originalAmount);
      const allocatedSoFar = Math.round((refunded * cost) / amount);
      conversions.set(refund.id, {
        cost: allocatedSoFar - allocated,
        rate,
        rateDate: assetCost.rateDate,
      });
      allocated = allocatedSoFar;
    }
  }

  for (const refund of refunds) {
    if (refund.refundMode !== 'FROM_ACTIVATION') {
      conversions.set(refund.id, await convertAtRefundChargeRate(injector, record, refund));
    }
  }
  return conversions;
}

/**
 * Converts one cost refund entered in the currency of a foreign-currency asset (see
 * `convertForeignRefunds`, which takes the asset's other refunds into account)
 */
export async function convertForeignRefund(
  injector: Injector,
  record: AssetCostRecord,
  refund: Omit<ForeignRefund, 'id'>,
): Promise<RefundConversion> {
  const id = 'refund';
  const conversion = (await convertForeignRefunds(injector, record, [{ ...refund, id }])).get(id);
  if (!conversion) {
    throw new GraphQLError(`Unable to convert the cost refund of depreciation record ${record.id}`);
  }
  return conversion;
}

async function convertAtRefundChargeRate(
  injector: Injector,
  record: AssetCostRecord,
  refund: ForeignRefund,
): Promise<RefundConversion> {
  const { defaultLocalCurrency } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();
  if (!record.currency) {
    throw new GraphQLError(`Depreciation record ${record.id} has no currency`);
  }
  const rateDate = refund.chargeId
    ? ((await getChargeDocumentsMeta(refund.chargeId, injector)).documentsMinDate ??
      refund.refundDate)
    : refund.refundDate;
  let rate: number;
  try {
    rate = await injector
      .get(ExchangeProvider)
      .getExchangeRates(record.currency as Currency, defaultLocalCurrency, rateDate);
  } catch (error) {
    console.error(error);
    throw new GraphQLError(
      `Unable to convert the cost refund of depreciation record ${record.id} from ${record.currency} to ${defaultLocalCurrency} at ${rateDate}`,
    );
  }
  return { cost: roundToAgorot(refund.originalAmount * rate), rate, rateDate };
}
