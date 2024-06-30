import type { IGetChargesByIdsResult } from '@modules/charges/types';
import {
  EXPENSES_IN_ADVANCE_TAX_CATEGORY,
  EXPENSES_TO_PAY_TAX_CATEGORY,
  INCOME_IN_ADVANCE_TAX_CATEGORY,
  INCOME_TO_COLLECT_TAX_CATEGORY,
  INPUT_VAT_TAX_CATEGORY_ID,
  OUTPUT_VAT_TAX_CATEGORY_ID,
} from '@shared/constants';
import type { LedgerProto } from '@shared/types';

function divideAmount(yearsCount: number, amount?: number): number | undefined {
  if (yearsCount === 1) {
    return amount;
  }
  return amount ? amount / yearsCount : undefined;
}

function divideEntryAmounts(entry: LedgerProto, yearsCount: number): Partial<LedgerProto> {
  return {
    creditAmount1: divideAmount(yearsCount, entry.creditAmount1),
    creditAmount2: divideAmount(yearsCount, entry.creditAmount2),
    debitAmount1: divideAmount(yearsCount, entry.debitAmount1),
    debitAmount2: divideAmount(yearsCount, entry.debitAmount2),
    localCurrencyCreditAmount1: divideAmount(yearsCount, entry.localCurrencyCreditAmount1),
    localCurrencyCreditAmount2: divideAmount(yearsCount, entry.localCurrencyCreditAmount2),
    localCurrencyDebitAmount1: divideAmount(yearsCount, entry.localCurrencyDebitAmount1),
    localCurrencyDebitAmount2: divideAmount(yearsCount, entry.localCurrencyDebitAmount2),
  };
}

export function handleCrossYearLedgerEntries(
  charge: IGetChargesByIdsResult,
  accountingLedgerEntries: LedgerProto[],
  financialAccountLedgerEntries: LedgerProto[],
): LedgerProto[] | null {
  const { years_of_relevance } = charge;
  const entries = [...accountingLedgerEntries, ...financialAccountLedgerEntries];
  if (entries.length === 0) {
    return null;
  }

  if (!years_of_relevance) {
    return null;
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

    const yearsCount = years_of_relevance.length;
    const amounts = divideEntryAmounts(adjustedEntry, yearsCount);

    for (const yearDate of years_of_relevance) {
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
