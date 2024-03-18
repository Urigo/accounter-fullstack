import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { EXPENSES_TO_PAY_TAX_CATEGORY, INCOME_TO_COLLECT_TAX_CATEGORY } from '@shared/constants';
import type { LedgerProto } from '@shared/types';

function divideAmount(yearsCount: number, amount?: number): number | undefined {
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
    if (years_of_relevance.length === 1) {
      const yearOfRelevance = years_of_relevance[0];
      if (
        entry.invoiceDate.getFullYear() === yearOfRelevance.getFullYear() &&
        entry.valueDate.getFullYear() === yearOfRelevance.getFullYear()
      ) {
        crossYearEntries.push(entry);
        continue;
      }

      const mediateTaxCategory = entry.isCreditorCounterparty
        ? EXPENSES_TO_PAY_TAX_CATEGORY
        : INCOME_TO_COLLECT_TAX_CATEGORY;
      const isYearOfRelevancePrior =
        entry.invoiceDate.getFullYear() > yearOfRelevance.getFullYear();
      const yearOfRelevanceDates = isYearOfRelevancePrior
        ? { invoiceDate: new Date(yearOfRelevance.getFullYear(), 11, 31) }
        : { invoiceDate: new Date(yearOfRelevance.getFullYear(), 0, 1) };
      crossYearEntries.push(
        {
          // first chronological entry
          ...entry,
          ...(entry.isCreditorCounterparty
            ? { creditAccountID1: mediateTaxCategory }
            : { debitAccountID1: mediateTaxCategory }),
          ...(isYearOfRelevancePrior ? yearOfRelevanceDates : {}),
        },
        {
          // second chronological entry
          ...entry,
          ...(entry.isCreditorCounterparty
            ? { debitAccountID1: mediateTaxCategory }
            : { creditAccountID1: mediateTaxCategory }),
          ...(isYearOfRelevancePrior ? {} : yearOfRelevanceDates),
        },
      );
    } else {
      const yearsCount = years_of_relevance.length;
      const amounts = divideEntryAmounts(entry, yearsCount);

      for (const yearDate of years_of_relevance) {
        if (
          entry.invoiceDate.getFullYear() === yearDate.getFullYear() &&
          entry.valueDate.getFullYear() === yearDate.getFullYear()
        ) {
          crossYearEntries.push({ ...entry, ...amounts });
          continue;
        }
        const isYearOfRelevancePrior = entry.invoiceDate.getFullYear() > yearDate.getFullYear();
        const yearOfRelevanceDates = isYearOfRelevancePrior
          ? { invoiceDate: new Date(yearDate.getFullYear(), 11, 31) }
          : { invoiceDate: new Date(yearDate.getFullYear(), 0, 1) };
        crossYearEntries.push({
          ...entry,
          ...amounts,
          ...yearOfRelevanceDates,
        });
      }
    }
  }
  return crossYearEntries;
}
