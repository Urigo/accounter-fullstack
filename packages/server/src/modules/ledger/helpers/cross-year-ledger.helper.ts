import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { EXPENSES_TO_PAY_TAX_CATEGORY, INCOME_TO_COLLECT_TAX_CATEGORY } from '@shared/constants';
import type { LedgerProto } from '@shared/types';

function checkForYearCrossing(entries: LedgerProto[]): [boolean, [Date, Date]] {
  let minDate = entries[0].invoiceDate.getTime();
  let maxDate = entries[0].invoiceDate.getTime();

  entries.map(entry => {
    if (entry.invoiceDate.getTime() < minDate) {
      minDate = entry.invoiceDate.getTime();
    }

    if (entry.invoiceDate.getTime() > maxDate) {
      maxDate = entry.invoiceDate.getTime();
    }
  });

  return [
    new Date(minDate).getFullYear() !== new Date(maxDate).getFullYear(),
    [new Date(minDate), new Date(maxDate)],
  ];
}

export function handleCrossYearLedgerEntries(
  charge: IGetChargesByIdsResult,
  accountingLedgerEntries: LedgerProto[],
  financialAccountLedgerEntries: LedgerProto[],
): LedgerProto[] | null {
  const { year_of_relevance } = charge;
  const entries = [...accountingLedgerEntries, ...financialAccountLedgerEntries];
  if (entries.length === 0) {
    return null;
  }

  const [isCrossYearCharge, [minDate, maxDate]] = checkForYearCrossing(entries);

  if (maxDate.getFullYear() - minDate.getFullYear() > 2) {
    throw new Error('Unable to handle charges stretched over >2 years');
  }

  if (!year_of_relevance && !isCrossYearCharge) {
    return null;
  }

  // calculate cross year entries
  const crossYearEntries: LedgerProto[] = [];

  if (year_of_relevance) {
    for (const entry of accountingLedgerEntries) {
      if (entry.invoiceDate.getFullYear() === year_of_relevance.getFullYear()) {
        crossYearEntries.push(entry);
        continue;
      }

      const mediateTaxCategory = entry.isCreditorCounterparty
        ? EXPENSES_TO_PAY_TAX_CATEGORY
        : INCOME_TO_COLLECT_TAX_CATEGORY;
      const isYearOfRelevancePrior =
        entry.invoiceDate.getFullYear() > year_of_relevance.getFullYear();
      const yearOfRelevanceDates = isYearOfRelevancePrior
        ? { invoiceDate: new Date(year_of_relevance.getFullYear(), 11, 31) }
        : { invoiceDate: new Date(year_of_relevance.getFullYear(), 0, 1) };
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
    }
    return crossYearEntries;
  }

  for (const entry of accountingLedgerEntries) {
    const [yearOfRelevance, isYearOfRelevancePrior]: [Date, boolean] =
      entry.invoiceDate.getFullYear() === minDate.getFullYear()
        ? [maxDate, false]
        : [minDate, true];

    const mediateTaxCategory = entry.isCreditorCounterparty
      ? EXPENSES_TO_PAY_TAX_CATEGORY
      : INCOME_TO_COLLECT_TAX_CATEGORY;
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
  }
  return crossYearEntries;
}
