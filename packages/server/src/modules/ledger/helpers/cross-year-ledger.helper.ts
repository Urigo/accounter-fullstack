import { ChargeSpreadProvider } from '@modules/charges/providers/charge-spread.provider.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { Currency } from '@shared/enums';
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
  defaultLocalCurrency: Currency,
): Partial<
  Pick<
    LedgerProto,
    'creditAmount1' | 'debitAmount1' | 'localCurrencyCreditAmount1' | 'localCurrencyDebitAmount1'
  >
> {
  const originAmount =
    entry.currency === defaultLocalCurrency ? entry.localCurrencyDebitAmount1 : entry.debitAmount1;
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
  defaultLocalCurrency: Currency,
): Partial<LedgerProto> | null {
  if (stringAmount === null) {
    return null;
  }
  const partialAmount = Number(stringAmount);
  if (Number.isNaN(partialAmount)) {
    return null;
  }

  const mainAmount = getEntryMainAmount(entry, defaultLocalCurrency);

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
  context: GraphQLModules.Context,
  accountingLedgerEntries: LedgerProto[],
): Promise<LedgerProto[] | null> {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      crossYear: {
        expensesToPayTaxCategoryId,
        expensesInAdvanceTaxCategoryId,
        incomeInAdvanceTaxCategoryId,
        incomeToCollectTaxCategoryId,
      },
    },
  } = context;
  if (accountingLedgerEntries.length === 0) {
    return null;
  }
  if (
    !expensesToPayTaxCategoryId ||
    !expensesInAdvanceTaxCategoryId ||
    !incomeInAdvanceTaxCategoryId ||
    !incomeToCollectTaxCategoryId
  ) {
    throw new LedgerError('Some cross-year tax categories are not set');
  }

  const spreadRecords = await injector
    .get(ChargeSpreadProvider)
    .getChargeSpreadByChargeIdLoader.load(charge.id);

  if (!spreadRecords?.length) {
    return null;
  }
  if (accountingLedgerEntries.length > 1 && spreadRecords.length > 1) {
    throw new LedgerError('Unable to split multiple documents into multiple years');
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

  const entriesAmount = accountingLedgerEntries
    .map(entry => {
      const { adjustedEntry } = splitVatPayments(entry, context);
      return adjustedEntry;
    })
    .reduce((acc, entry) => {
      const mainAmount = getEntryMainAmount(entry, defaultLocalCurrency);
      return acc + mainAmount;
    }, 0);

  // handle current year auto-added spread record if amounts do not match
  if (
    yearsWithoutSpecifiedAmountCount === 0 &&
    Math.abs(predefinedAmount - entriesAmount) > 0.005
  ) {
    const chargeDate = charge.documents_min_date;
    if (
      chargeDate &&
      !spreadRecords.some(r => r.year_of_relevance.getFullYear() === chargeDate.getFullYear())
    ) {
      spreadRecords.push({
        charge_id: charge.id,
        year_of_relevance: chargeDate,
        amount: null,
      });
      yearsWithoutSpecifiedAmountCount += 1;
    } else {
      throw new Error('Spread amounts do not match ledger entries amounts');
    }
  }

  let description: string | undefined = undefined;
  if (charge.business_id) {
    try {
      const mainBusiness = await injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(charge.business_id);
      if (mainBusiness) {
        description = `Main counterparty: ${mainBusiness.name}`;
      }
    } catch (error) {
      console.error('Failed to load financial entity:', error);
    }
  }

  // calculate cross year entries
  const crossYearEntries: LedgerProto[] = [];
  if (accountingLedgerEntries.length === 1) {
    const entry = accountingLedgerEntries[0];
    const { adjustedEntry, vatEntries } = splitVatPayments(entry, context);
    crossYearEntries.push(...vatEntries);

    const defaultAmounts = divideEntryAmounts(
      adjustedEntry,
      yearsWithoutSpecifiedAmountCount,
      predefinedAmount,
      defaultLocalCurrency,
    );

    for (const spreadRecord of spreadRecords) {
      const amounts =
        getPartialEntryAmounts(adjustedEntry, spreadRecord.amount, defaultLocalCurrency) ??
        defaultAmounts;
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
      const mediateTaxCategory =
        !!adjustedEntry.isCreditorCounterparty === !!adjustedEntry.isCreditInvoice
          ? isYearOfRelevancePrior
            ? incomeToCollectTaxCategoryId
            : incomeInAdvanceTaxCategoryId
          : isYearOfRelevancePrior
            ? expensesToPayTaxCategoryId
            : expensesInAdvanceTaxCategoryId;

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
          ...(isYearOfRelevancePrior ? { vat: undefined, description } : {}),
        },
        {
          // second chronological entry
          ...adjustedEntry,
          ...amounts,
          ...(adjustedEntry.isCreditorCounterparty
            ? { debitAccountID1: mediateTaxCategory }
            : { creditAccountID1: mediateTaxCategory }),
          ...(isYearOfRelevancePrior ? {} : { vat: undefined, description }),
        },
      );
    }
  } else if (spreadRecords.length === 1) {
    const spreadRecord = spreadRecords[0];
    const yearDate = spreadRecord.year_of_relevance;

    validateEntriesAmountsMatchesSpread(spreadRecord.amount, entriesAmount);

    for (const entry of accountingLedgerEntries) {
      const { adjustedEntry, vatEntries } = splitVatPayments(entry, context);
      crossYearEntries.push(...vatEntries);

      if (
        adjustedEntry.invoiceDate.getFullYear() === yearDate.getFullYear() &&
        adjustedEntry.valueDate.getFullYear() === yearDate.getFullYear()
      ) {
        crossYearEntries.push(adjustedEntry);
        continue;
      }

      const isYearOfRelevancePrior =
        adjustedEntry.invoiceDate.getFullYear() > yearDate.getFullYear();
      const mediateTaxCategory =
        !!adjustedEntry.isCreditorCounterparty === !!adjustedEntry.isCreditInvoice
          ? isYearOfRelevancePrior
            ? incomeToCollectTaxCategoryId
            : incomeInAdvanceTaxCategoryId
          : isYearOfRelevancePrior
            ? expensesToPayTaxCategoryId
            : expensesInAdvanceTaxCategoryId;

      const yearOfRelevanceDates = isYearOfRelevancePrior
        ? { invoiceDate: new Date(yearDate.getFullYear(), 11, 31) }
        : { invoiceDate: new Date(yearDate.getFullYear(), 0, 1) };
      crossYearEntries.push(
        {
          // first chronological entry
          ...adjustedEntry,
          ...(adjustedEntry.isCreditorCounterparty
            ? { creditAccountID1: mediateTaxCategory }
            : { debitAccountID1: mediateTaxCategory }),
          ...yearOfRelevanceDates,
          ...(isYearOfRelevancePrior ? { vat: undefined, description } : {}),
        },
        {
          // second chronological entry
          ...adjustedEntry,
          ...(adjustedEntry.isCreditorCounterparty
            ? { debitAccountID1: mediateTaxCategory }
            : { creditAccountID1: mediateTaxCategory }),
          ...(isYearOfRelevancePrior ? {} : { vat: undefined, description }),
        },
      );
    }
  }
  return crossYearEntries;
}

function splitVatPayments(
  entry: LedgerProto,
  context: GraphQLModules.Context,
): {
  adjustedEntry: LedgerProto;
  vatEntries: LedgerProto[];
} {
  const { inputVatTaxCategoryId, outputVatTaxCategoryId } = context.adminContext.authorities;
  const vatTaxIds = [inputVatTaxCategoryId, outputVatTaxCategoryId];
  const vatEntries: LedgerProto[] = [];
  const adjustedEntry = { ...entry };
  if (vatTaxIds.includes(entry.creditAccountID2 ?? '')) {
    vatEntries.push({
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
  } else if (vatTaxIds.includes(entry.debitAccountID2 ?? '')) {
    vatEntries.push({
      ...entry,
      debitAccountID1: entry.debitAccountID2,
      debitAmount1: entry.debitAmount2,
      creditAmount1: entry.debitAmount2,
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

  if (adjustedEntry.creditAmount1 !== adjustedEntry.debitAmount1) {
    throw new LedgerError('Credit and debit amounts are not equal');
  }

  return { adjustedEntry, vatEntries };
}

function getEntryMainAmount(entry: LedgerProto, defaultLocalCurrency: Currency): number {
  const mainAmount = Math.abs(
    Math.max(
      ...(entry.currency === defaultLocalCurrency
        ? [entry.localCurrencyDebitAmount1 ?? 0, entry.localCurrencyCreditAmount1 ?? 0]
        : [entry.debitAmount1 ?? 0, entry.creditAmount1 ?? 0]),
    ),
  );

  return mainAmount;
}

function validateEntriesAmountsMatchesSpread(
  spreadStringifiedAmount: string | null,
  entriesAmount: number,
): void {
  if (spreadStringifiedAmount === null) {
    return;
  }
  const spreadAmount = Number(spreadStringifiedAmount);
  if (Number.isNaN(spreadAmount)) {
    return;
  }

  if (spreadAmount !== entriesAmount) {
    throw new LedgerError('Spread amount does not match ledger entries amounts');
  }
}
