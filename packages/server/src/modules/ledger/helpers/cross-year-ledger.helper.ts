import type { IGetChargesByIdsResult } from '@modules/charges/types';
import {
  EXPENSES_IN_ADVANCE_TAX_CATEGORY,
  EXPENSES_TO_PAY_TAX_CATEGORY,
  INCOME_IN_ADVANCE_TAX_CATEGORY,
  INCOME_TO_COLLECT_TAX_CATEGORY,
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
      const mediateTaxCategory = entry.isCreditorCounterparty
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
          ...entry,
          ...amounts,
          ...(entry.isCreditorCounterparty
            ? { creditAccountID1: mediateTaxCategory }
            : { debitAccountID1: mediateTaxCategory }),
          ...yearOfRelevanceDates,
        },
        {
          // second chronological entry
          ...entry,
          ...amounts,
          ...(entry.isCreditorCounterparty
            ? { debitAccountID1: mediateTaxCategory }
            : { creditAccountID1: mediateTaxCategory }),
        },
      );
    }
  }
  return crossYearEntries;
}
