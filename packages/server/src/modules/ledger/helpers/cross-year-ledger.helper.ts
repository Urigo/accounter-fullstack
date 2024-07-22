import { Injector } from 'graphql-modules';
import { ChargeSpreadProvider } from '@modules/charges/providers/charge-spread.provider.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import {
  DEFAULT_LOCAL_CURRENCY,
  EXPENSES_IN_ADVANCE_TAX_CATEGORY,
  EXPENSES_TO_PAY_TAX_CATEGORY,
  INCOME_IN_ADVANCE_TAX_CATEGORY,
  INCOME_TO_COLLECT_TAX_CATEGORY,
  INPUT_VAT_TAX_CATEGORY_ID,
  OUTPUT_VAT_TAX_CATEGORY_ID,
} from '@shared/constants';
import type { LedgerProto } from '@shared/types';
import { LedgerError } from './utils.helper.js';

function divideAmount(yearsCount: number, amount?: number): number | undefined {
  if (yearsCount === 1) {
    return amount;
  }
  return amount ? amount / yearsCount : undefined;
}

function divideEntryAmounts(
  entry: LedgerProto,
  yearsCount: number,
  predefinedAmount = 0,
): Partial<
  Pick<
    LedgerProto,
    'creditAmount1' | 'debitAmount1' | 'localCurrencyCreditAmount1' | 'localCurrencyDebitAmount1'
  >
> {
  const originAmount =
    entry.currency === DEFAULT_LOCAL_CURRENCY
      ? entry.localCurrencyDebitAmount1
      : entry.debitAmount1;
  const ratio = 1 - Math.abs(predefinedAmount / originAmount!);
  return {
    creditAmount1: divideAmount(yearsCount, partialAmountCalculator(entry.creditAmount1, ratio)),
    debitAmount1: divideAmount(yearsCount, partialAmountCalculator(entry.debitAmount1, ratio)),
    localCurrencyCreditAmount1: divideAmount(
      yearsCount,
      partialAmountCalculator(entry.localCurrencyCreditAmount1, ratio),
    ),
    localCurrencyDebitAmount1: divideAmount(
      yearsCount,
      partialAmountCalculator(entry.localCurrencyDebitAmount1, ratio),
    ),
  };
}

function partialAmountCalculator(amount: number | undefined, ratio = 0): number | undefined {
  if (amount === undefined) {
    return undefined;
  }
  return amount * ratio;
}

function getPartialEntryAmounts(
  entry: LedgerProto,
  stringAmount: string | null,
): Partial<LedgerProto> | null {
  if (stringAmount === null) {
    return null;
  }
  const partialAmount = Number(stringAmount);
  if (Number.isNaN(partialAmount)) {
    return null;
  }

  const mainAmount = Math.abs(
    Math.max(
      ...(entry.currency === DEFAULT_LOCAL_CURRENCY
        ? [entry.localCurrencyDebitAmount1 ?? 0, entry.localCurrencyCreditAmount1 ?? 0]
        : [entry.debitAmount1 ?? 0, entry.creditAmount1 ?? 0]),
    ),
  );

  if ((entry.debitAmount1 || entry.creditAmount1) && partialAmount > mainAmount) {
    throw new LedgerError('Partial amount exceeds ledger record amount');
  }

  const ratio = partialAmount / mainAmount;

  return {
    creditAmount1: partialAmountCalculator(entry.creditAmount1, ratio),
    creditAmount2: partialAmountCalculator(entry.creditAmount2, ratio),
    debitAmount1: partialAmountCalculator(entry.debitAmount1, ratio),
    debitAmount2: partialAmountCalculator(entry.debitAmount2, ratio),
    localCurrencyCreditAmount1: partialAmountCalculator(entry.localCurrencyCreditAmount1, ratio),
    localCurrencyCreditAmount2: partialAmountCalculator(entry.localCurrencyCreditAmount2, ratio),
    localCurrencyDebitAmount1: partialAmountCalculator(entry.localCurrencyDebitAmount1, ratio),
    localCurrencyDebitAmount2: partialAmountCalculator(entry.localCurrencyDebitAmount2, ratio),
  };
}

export async function handleCrossYearLedgerEntries(
  charge: IGetChargesByIdsResult,
  injector: Injector,
  accountingLedgerEntries: LedgerProto[],
): Promise<LedgerProto[] | null> {
  if (accountingLedgerEntries.length === 0) {
    return null;
  }
  const spreadRecords = await injector
    .get(ChargeSpreadProvider)
    .getChargeSpreadByChargeIdLoader.load(charge.id);

  if (!spreadRecords?.length) {
    return null;
  }
  if (accountingLedgerEntries.length > 1) {
    throw new LedgerError('Unable to split multiple documents');
  }

  // calculate cross year entries
  const crossYearEntries: LedgerProto[] = [];
  for (const entry of accountingLedgerEntries) {
    const adjustedEntry = { ...entry };
    if (entry.creditAccountID2 && entry.creditAccountID2 === INPUT_VAT_TAX_CATEGORY_ID) {
      crossYearEntries.push({
        ...entry,
        creditAccountID1: entry.creditAccountID2,
        creditAccountID2: undefined,
        creditAmount1: entry.creditAmount2,
        creditAmount2: undefined,
        localCurrencyCreditAmount1: entry.localCurrencyCreditAmount2!,
        localCurrencyCreditAmount2: undefined,
        localCurrencyDebitAmount1: entry.localCurrencyCreditAmount2!,
        localCurrencyDebitAmount2: undefined,
      });

      // remove VAT from main entry
      adjustedEntry.debitAmount1 &&= adjustedEntry.debitAmount1 - (entry.creditAmount2 ?? 0);
      adjustedEntry.localCurrencyDebitAmount1 &&=
        adjustedEntry.localCurrencyDebitAmount1 - entry.localCurrencyCreditAmount2!;
      adjustedEntry.creditAccountID2 = undefined;
      adjustedEntry.creditAmount2 = undefined;
      adjustedEntry.localCurrencyCreditAmount2 = undefined;
    } else if (entry.debitAccountID2 && entry.debitAccountID2 === OUTPUT_VAT_TAX_CATEGORY_ID) {
      crossYearEntries.push({
        ...entry,
        debitAccountID1: entry.debitAccountID2,
        debitAmount1: entry.debitAmount2,
        localCurrencyDebitAmount1: entry.localCurrencyDebitAmount2!,

        localCurrencyCreditAmount1: entry.localCurrencyDebitAmount2!,

        debitAccountID2: undefined,
        debitAmount2: undefined,
        localCurrencyDebitAmount2: undefined,

        creditAccountID2: undefined,
        creditAmount2: undefined,
        localCurrencyCreditAmount2: undefined,
      });

      // remove VAT from main entry
      adjustedEntry.creditAmount1 &&= adjustedEntry.creditAmount1 - (entry.debitAmount2 ?? 0);
      adjustedEntry.localCurrencyCreditAmount1 &&=
        adjustedEntry.localCurrencyCreditAmount1 - entry.localCurrencyDebitAmount2!;
      adjustedEntry.debitAccountID2 = undefined;
      adjustedEntry.debitAmount2 = undefined;
      adjustedEntry.localCurrencyDebitAmount2 = undefined;
    }

    let yearsWithoutSpecifiedAmountCount = 0;
    let predefinedAmount = 0;
    spreadRecords.map(record => {
      if (record.amount === null) {
        yearsWithoutSpecifiedAmountCount += 1;
      } else {
        predefinedAmount += Number(record.amount);
      }
    });

    if (adjustedEntry.creditAmount1 !== adjustedEntry.debitAmount1) {
      throw new LedgerError('Credit and debit amounts are not equal');
    }
    const defaultAmounts = divideEntryAmounts(
      adjustedEntry,
      yearsWithoutSpecifiedAmountCount,
      predefinedAmount,
    );

    for (const spreadRecord of spreadRecords) {
      const amounts = getPartialEntryAmounts(adjustedEntry, spreadRecord.amount) ?? defaultAmounts;
      const yearDate = spreadRecord.year_of_relevance;
      if (
        adjustedEntry.invoiceDate.getFullYear() === yearDate.getFullYear() &&
        adjustedEntry.valueDate.getFullYear() === yearDate.getFullYear()
      ) {
        crossYearEntries.push({ ...adjustedEntry, ...amounts });
        continue;
      }

      const isYearOfRelevancePrior =
        adjustedEntry.invoiceDate.getFullYear() > yearDate.getFullYear();
      const mediateTaxCategory = adjustedEntry.isCreditorCounterparty
        ? isYearOfRelevancePrior
          ? EXPENSES_TO_PAY_TAX_CATEGORY
          : EXPENSES_IN_ADVANCE_TAX_CATEGORY
        : isYearOfRelevancePrior
          ? INCOME_TO_COLLECT_TAX_CATEGORY
          : INCOME_IN_ADVANCE_TAX_CATEGORY;

      const yearOfRelevanceDates = isYearOfRelevancePrior
        ? { invoiceDate: new Date(yearDate.getFullYear(), 11, 31) }
        : { invoiceDate: new Date(yearDate.getFullYear(), 0, 1) };
      crossYearEntries.push(
        {
          // first chronological entry
          ...adjustedEntry,
          ...amounts,
          ...(adjustedEntry.isCreditorCounterparty
            ? { creditAccountID1: mediateTaxCategory }
            : { debitAccountID1: mediateTaxCategory }),
          ...yearOfRelevanceDates,
          ...(isYearOfRelevancePrior ? { vat: undefined } : {}),
        },
        {
          // second chronological entry
          ...adjustedEntry,
          ...amounts,
          ...(adjustedEntry.isCreditorCounterparty
            ? { debitAccountID1: mediateTaxCategory }
            : { creditAccountID1: mediateTaxCategory }),
          ...(isYearOfRelevancePrior ? {} : { vat: undefined }),
        },
      );
    }
  }
  return crossYearEntries;
}
