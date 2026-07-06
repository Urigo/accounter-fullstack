import { Currency } from '../../../shared/enums.js';
import type { LedgerProto } from '../../../shared/types/index.js';
import { LedgerError } from './utils.helper.js';

/**
 * Aggregates all main ledger entries of a single conversion side (base or quote) into one
 * representative LedgerProto. The entries are expected to share the same currency; foreign and
 * local amounts are summed while meta fields are copied from the first entry. For a side with a
 * single entry the result is equivalent to that entry.
 */
export function aggregateConversionSideEntries(entries: LedgerProto[]): LedgerProto {
  const [first, ...rest] = entries;
  if (!first) {
    throw new LedgerError('Cannot aggregate an empty conversion side');
  }
  if (rest.length === 0) {
    return first;
  }

  let foreignAmount = 0;
  let localAmount = 0;
  for (const entry of entries) {
    foreignAmount += entry.creditAmount1 ?? 0;
    localAmount += entry.localCurrencyCreditAmount1;
  }

  const absForeignAmount = foreignAmount || undefined;

  return {
    ...first,
    creditAmount1: absForeignAmount,
    debitAmount1: absForeignAmount,
    localCurrencyCreditAmount1: localAmount,
    localCurrencyDebitAmount1: localAmount,
  };
}

export function conversionFeeCalculator(
  base: LedgerProto,
  quote: LedgerProto,
  officialRate: number,
  defaultLocalCurrency: Currency,
): number {
  if (base.currency === quote.currency) {
    throw new LedgerError('Conversion records must have different currencies');
  }

  if (quote.currency === defaultLocalCurrency) {
    const baseAmount = (base.creditAmount1 ?? 0) / officialRate;

    const feeAmountByQuoteCurrency = quote.localCurrencyCreditAmount1 - baseAmount;

    return feeAmountByQuoteCurrency;
  }
  return quote.localCurrencyCreditAmount1 - base.localCurrencyCreditAmount1;
}
