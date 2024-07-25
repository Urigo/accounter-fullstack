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
) {
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
  records: DecoratedLedgerRecord[],
  validation: (sortCode: number) => boolean,
): number {
  let amount = 0;
  records.map(record => {
    if (record.credit_entity1 && validation(record.credit_entity_sort_code1!)) {
      amount += Number(record.credit_local_amount1);
    }
    if (record.credit_entity2 && validation(record.credit_entity_sort_code2!)) {
      amount += Number(record.credit_local_amount2);
    }
    if (record.debit_entity1 && validation(record.debit_entity_sort_code1!)) {
      amount -= Number(record.debit_local_amount1);
    }
    if (record.debit_entity2 && validation(record.debit_entity_sort_code2!)) {
      amount -= Number(record.debit_local_amount2);
    }
  });

  return amount;
}

export function getProfitLossReportAmounts(decoratedLedgerRecords: DecoratedLedgerRecord[]) {
  const revenueAmount = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => Math.floor(sortCode / 100) === 8,
  );

  const costOfSalesAmount = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 910,
  );

  const grossProfitAmount = revenueAmount + costOfSalesAmount;

  const researchAndDevelopmentExpensesAmount = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => [920, 921, 930].includes(sortCode),
  );

  const marketingExpensesAmount = amountBySortCodeValidation(decoratedLedgerRecords, sortCode =>
    [935, 936].includes(sortCode),
  );

  const managementAndGeneralExpensesAmount = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => [940, 945].includes(sortCode),
  );

  const operatingProfitAmount =
    grossProfitAmount +
    researchAndDevelopmentExpensesAmount +
    marketingExpensesAmount +
    managementAndGeneralExpensesAmount;

  const financialExpensesAmount = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 990,
  );

  const otherIncomeAmount = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 995,
  );

  const profitBeforeTaxAmount = operatingProfitAmount + financialExpensesAmount + otherIncomeAmount;

  return {
    revenueAmount,
    costOfSalesAmount,
    grossProfitAmount,
    researchAndDevelopmentExpensesAmount,
    marketingExpensesAmount,
    managementAndGeneralExpensesAmount,
    operatingProfitAmount,
    financialExpensesAmount,
    otherIncomeAmount,
    profitBeforeTaxAmount,
  };
}
