import type { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import type { IGetLedgerRecordsByDatesResult } from '@modules/ledger/types.js';

export type LedgerRecordDecorations = Partial<{
  credit_entity_sort_code1: number;
  credit_entity_sort_code2: number;
  debit_entity_sort_code1: number;
  debit_entity_sort_code2: number;
}>;

export type DecoratedLedgerRecord = IGetLedgerRecordsByDatesResult & LedgerRecordDecorations;

export function decorateLedgerRecords(
  ledgerRecords: IGetLedgerRecordsByDatesResult[],
  financialEntitiesDict: Map<string, IGetFinancialEntitiesByIdsResult>,
): DecoratedLedgerRecord[] {
  return ledgerRecords.map(record => {
    const sortCodes: LedgerRecordDecorations = {};
    if (record.credit_entity1) {
      const sortCode = financialEntitiesDict.get(record.credit_entity1)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.credit_entity1}`);
      }
      sortCodes.credit_entity_sort_code1 = sortCode ?? undefined;
    }
    if (record.credit_entity2) {
      const sortCode = financialEntitiesDict.get(record.credit_entity2)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.credit_entity2}`);
      }
      sortCodes.credit_entity_sort_code2 = sortCode ?? undefined;
    }
    if (record.debit_entity1) {
      const sortCode = financialEntitiesDict.get(record.debit_entity1)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.debit_entity1}`);
      }
      sortCodes.debit_entity_sort_code1 = sortCode ?? undefined;
    }
    if (record.debit_entity2) {
      const sortCode = financialEntitiesDict.get(record.debit_entity2)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.debit_entity2}`);
      }
      sortCodes.debit_entity_sort_code2 = sortCode ?? undefined;
    }
    return {
      ...record,
      ...sortCodes,
    };
  });
}

export function amountBySortCodeValidation(
  unfilteredRecords: DecoratedLedgerRecord[],
  validation: (sortCode: number) => boolean,
): { amount: number; records: DecoratedLedgerRecord[]; entityIds: string[] } {
  let amount = 0;
  const records: DecoratedLedgerRecord[] = [];
  const entityIdsSet = new Set<string>();
  unfilteredRecords.map(record => {
    let shouldIncludeRecord = false;
    if (record.credit_entity1 && validation(record.credit_entity_sort_code1!)) {
      shouldIncludeRecord = true;
      entityIdsSet.add(record.credit_entity1);
      amount += Number(record.credit_local_amount1);
    }
    if (record.credit_entity2 && validation(record.credit_entity_sort_code2!)) {
      shouldIncludeRecord = true;
      entityIdsSet.add(record.credit_entity2);
      amount += Number(record.credit_local_amount2);
    }
    if (record.debit_entity1 && validation(record.debit_entity_sort_code1!)) {
      shouldIncludeRecord = true;
      entityIdsSet.add(record.debit_entity1);
      amount -= Number(record.debit_local_amount1);
    }
    if (record.debit_entity2 && validation(record.debit_entity_sort_code2!)) {
      shouldIncludeRecord = true;
      entityIdsSet.add(record.debit_entity2);
      amount -= Number(record.debit_local_amount2);
    }
    if (shouldIncludeRecord) {
      records.push(record);
    }
  });

  return { amount, records, entityIds: Array.from(entityIdsSet) };
}

export function getProfitLossReportAmounts(decoratedLedgerRecords: DecoratedLedgerRecord[]) {
  const { amount: revenueAmount, records: revenueRecords } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => Math.floor(sortCode / 100) === 8,
  );

  const { amount: costOfSalesAmount, records: costOfSalesRecords } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 910,
  );

  const grossProfitAmount = revenueAmount + costOfSalesAmount;

  const {
    amount: researchAndDevelopmentExpensesAmount,
    records: researchAndDevelopmentExpensesRecords,
  } = amountBySortCodeValidation(decoratedLedgerRecords, sortCode =>
    [920, 921, 930].includes(sortCode),
  );

  const { amount: marketingExpensesAmount, records: marketingExpensesRecords } =
    amountBySortCodeValidation(decoratedLedgerRecords, sortCode => [935, 936].includes(sortCode));

  const {
    amount: managementAndGeneralExpensesAmount,
    records: managementAndGeneralExpensesRecords,
  } = amountBySortCodeValidation(decoratedLedgerRecords, sortCode => [940, 945].includes(sortCode));

  const operatingProfitAmount =
    grossProfitAmount +
    researchAndDevelopmentExpensesAmount +
    marketingExpensesAmount +
    managementAndGeneralExpensesAmount;

  const { amount: financialExpensesAmount, records: financialExpensesRecords } =
    amountBySortCodeValidation(decoratedLedgerRecords, sortCode => sortCode === 990);

  const { amount: otherIncomeAmount, records: otherIncomeRecords } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 995,
  );

  const profitBeforeTaxAmount = operatingProfitAmount + financialExpensesAmount + otherIncomeAmount;
  const profitBeforeTaxRecordsWithDuplications = [
    ...revenueRecords,
    ...costOfSalesRecords,
    ...researchAndDevelopmentExpensesRecords,
    ...marketingExpensesRecords,
    ...managementAndGeneralExpensesRecords,
    ...financialExpensesRecords,
    ...otherIncomeRecords,
  ];
  const profitBeforeTaxRecordsSet = new Map<string, DecoratedLedgerRecord>(
    profitBeforeTaxRecordsWithDuplications.map(record => [record.id, record]),
  );
  const profitBeforeTaxRecords = Array.from(profitBeforeTaxRecordsSet.values());

  return {
    revenueAmount,
    revenueRecords,

    costOfSalesAmount,
    costOfSalesRecords,

    grossProfitAmount,

    researchAndDevelopmentExpensesAmount,
    researchAndDevelopmentExpensesRecords,

    marketingExpensesAmount,
    marketingExpensesRecords,

    managementAndGeneralExpensesAmount,
    managementAndGeneralExpensesRecords,

    operatingProfitAmount,

    financialExpensesAmount,
    financialExpensesRecords,

    otherIncomeAmount,
    otherIncomeRecords,

    profitBeforeTaxAmount,
    profitBeforeTaxRecords,
  };
}
