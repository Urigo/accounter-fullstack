import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { Currency } from '../../../shared/enums.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import {
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import type { IGetDepreciationRecordsByIdsResult } from '../types.js';

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
 * The date a foreign-currency asset is converted at: the purchase charge's (earliest) document
 * date, falling back to its first payment date, then to the asset's activation date
 */
export async function getAssetRateDate(
  injector: Injector,
  record: Pick<AssetCostRecord, 'charge_id' | 'activation_date'>,
): Promise<TimelessDateString> {
  const { documentsMinDate } = await getChargeDocumentsMeta(record.charge_id, injector);
  if (documentsMinDate) {
    return documentsMinDate;
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
