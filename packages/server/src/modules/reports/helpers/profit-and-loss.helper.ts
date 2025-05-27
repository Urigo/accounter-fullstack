import type { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import type { IGetLedgerRecordsByDatesResult } from '@modules/ledger/types.js';
import {
  FilteringOptions,
  recordsByFinancialEntityIdAndSortCodeValidations,
} from './misc.helper.js';

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

export function getProfitLossReportAmounts(decoratedLedgerRecords: DecoratedLedgerRecord[]) {
  const revenueFilter: FilteringOptions = {
    rule: (_, sortCode) => [800, 810].includes(sortCode),
  };
  const costOfSalesFilter: FilteringOptions = {
    rule: (_, sortCode) => [910, 911, 912].includes(sortCode),
  };
  const researchAndDevelopmentExpensesFilter: FilteringOptions = {
    rule: (_, sortCode) => [920, 921, 922, 923, 924, 925, 930, 931].includes(sortCode),
  };
  const marketingExpensesFilter: FilteringOptions = {
    rule: (_, sortCode) => [935, 936].includes(sortCode),
  };
  const managementAndGeneralExpensesFilter: FilteringOptions = {
    rule: (_, sortCode) => [940, 941, 942, 943, 944, 945, 947, 948].includes(sortCode),
  };
  const financialExpensesFilter: FilteringOptions = {
    rule: (_, sortCode) => [990, 991].includes(sortCode),
  };
  const otherIncomeFilter: FilteringOptions = {
    rule: (_, sortCode) => sortCode === 995,
  };
  const [
    revenue,
    costOfSales,
    researchAndDevelopmentExpenses,
    marketingExpenses,
    managementAndGeneralExpenses,
    financialExpenses,
    otherIncome,
  ] = recordsByFinancialEntityIdAndSortCodeValidations(decoratedLedgerRecords, [
    revenueFilter,
    costOfSalesFilter,
    researchAndDevelopmentExpensesFilter,
    marketingExpensesFilter,
    managementAndGeneralExpensesFilter,
    financialExpensesFilter,
    otherIncomeFilter,
  ]);
  const { amount: revenueAmount, records: revenueRecords } = revenue;
  const { amount: costOfSalesAmount, records: costOfSalesRecords } = costOfSales;

  const grossProfitAmount = revenueAmount + costOfSalesAmount;

  const {
    amount: researchAndDevelopmentExpensesAmount,
    records: researchAndDevelopmentExpensesRecords,
  } = researchAndDevelopmentExpenses;

  const { amount: marketingExpensesAmount, records: marketingExpensesRecords } = marketingExpenses;

  const {
    amount: managementAndGeneralExpensesAmount,
    records: managementAndGeneralExpensesRecords,
  } = managementAndGeneralExpenses;

  const operatingProfitAmount =
    grossProfitAmount +
    researchAndDevelopmentExpensesAmount +
    marketingExpensesAmount +
    managementAndGeneralExpensesAmount;

  const { amount: financialExpensesAmount, records: financialExpensesRecords } = financialExpenses;
  const { amount: otherIncomeAmount, records: otherIncomeRecords } = otherIncome;

  const profitBeforeTaxAmount = operatingProfitAmount + financialExpensesAmount + otherIncomeAmount;
  const profitBeforeTaxRecords = [
    ...revenueRecords,
    ...costOfSalesRecords,
    ...researchAndDevelopmentExpensesRecords,
    ...marketingExpensesRecords,
    ...managementAndGeneralExpensesRecords,
    ...financialExpensesRecords,
    ...otherIncomeRecords,
  ];
  const profitBeforeTax = {
    amount: profitBeforeTaxAmount,
    records: profitBeforeTaxRecords,
  };

  return {
    revenue,

    costOfSales,

    grossProfitAmount,

    researchAndDevelopmentExpenses,

    marketingExpenses,

    managementAndGeneralExpenses,

    operatingProfitAmount,

    financialExpenses,

    otherIncome,

    profitBeforeTax,
  };
}
