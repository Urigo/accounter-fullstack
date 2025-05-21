import type { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import type { IGetLedgerRecordsByDatesResult } from '@modules/ledger/types.js';
import type { CommentaryProto } from '../types.js';

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

export function updateRecords(
  amountsByEntity: Map<number, { amount: number; records: Map<string, number> }>,
  amount: number,
  sortCode: number,
  financialEntityId: string,
) {
  const currentRecord = amountsByEntity.get(sortCode);
  if (currentRecord) {
    currentRecord.amount += amount;
    const record = currentRecord.records.get(financialEntityId);
    if (record) {
      currentRecord.records.set(financialEntityId, record + amount);
    } else {
      currentRecord.records.set(financialEntityId, amount);
    }
  } else {
    amountsByEntity.set(sortCode, { amount, records: new Map([[financialEntityId, amount]]) });
  }
}

export function amountBySortCodeValidation(
  unfilteredRecords: DecoratedLedgerRecord[],
  validation: (sortCode: number) => boolean,
  negate: boolean = false,
): CommentaryProto {
  let amount = 0;
  const amountsByEntity = new Map<
    number,
    {
      amount: number;
      records: Map<string, number>;
    }
  >();
  const sign = negate ? -1 : 1;
  unfilteredRecords.map(record => {
    if (record.credit_entity1 && validation(record.credit_entity_sort_code1!)) {
      const recordAmount = Number(record.credit_local_amount1) * sign;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.credit_entity_sort_code1!,
        record.credit_entity1,
      );
      amount += recordAmount;
    }
    if (record.credit_entity2 && validation(record.credit_entity_sort_code2!)) {
      const recordAmount = Number(record.credit_local_amount2) * sign;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.credit_entity_sort_code2!,
        record.credit_entity2,
      );
      amount += recordAmount;
    }
    if (record.debit_entity1 && validation(record.debit_entity_sort_code1!)) {
      const recordAmount = Number(record.debit_local_amount1) * sign * -1;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.debit_entity_sort_code1!,
        record.debit_entity1,
      );
      amount += recordAmount;
    }
    if (record.debit_entity2 && validation(record.debit_entity_sort_code2!)) {
      const recordAmount = Number(record.debit_local_amount2) * sign * -1;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.debit_entity_sort_code2!,
        record.debit_entity2,
      );
      amount += recordAmount;
    }
  });

  const records = Array.from(amountsByEntity.entries()).map(([sortCode, data]) => ({
    sortCode,
    amount: data.amount,
    records: Array.from(data.records.entries()).map(([financialEntityId, amount]) => ({
      financialEntityId,
      amount,
    })),
  }));

  return { amount, records };
}

export function amountByFinancialEntityIdAndSortCodeValidation(
  unfilteredRecords: DecoratedLedgerRecord[],
  validation: (financialEntityId: string, sortCode: number) => boolean,
  negate: boolean = false,
): number {
  let amount = 0;
  const sign = negate ? -1 : 1;
  unfilteredRecords.map(record => {
    if (
      record.credit_entity1 &&
      validation(record.credit_entity1, record.credit_entity_sort_code1!)
    ) {
      amount += Number(record.credit_local_amount1) * sign;
    }
    if (
      record.credit_entity2 &&
      validation(record.credit_entity2, record.credit_entity_sort_code2!)
    ) {
      amount += Number(record.credit_local_amount2) * sign;
    }
    if (record.debit_entity1 && validation(record.debit_entity1, record.debit_entity_sort_code1!)) {
      amount += Number(record.debit_local_amount1) * sign * -1;
    }
    if (record.debit_entity2 && validation(record.debit_entity2, record.debit_entity_sort_code2!)) {
      amount += Number(record.debit_local_amount2) * sign * -1;
    }
  });

  return amount;
}

export function recordsByFinancialEntityIdAndSortCodeValidation(
  unfilteredRecords: DecoratedLedgerRecord[],
  validation: (financialEntityId: string, sortCode: number) => boolean,
  negate: boolean = false,
): CommentaryProto {
  let amount = 0;
  const amountsByEntity = new Map<
    number,
    {
      amount: number;
      records: Map<string, number>;
    }
  >();

  const sign = negate ? -1 : 1;
  unfilteredRecords.map(record => {
    if (
      record.credit_entity1 &&
      validation(record.credit_entity1, record.credit_entity_sort_code1!)
    ) {
      const recordAmount = Number(record.credit_local_amount1) * sign;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.credit_entity_sort_code1!,
        record.credit_entity1,
      );
      amount += recordAmount;
    }
    if (
      record.credit_entity2 &&
      validation(record.credit_entity2, record.credit_entity_sort_code2!)
    ) {
      const recordAmount = Number(record.credit_local_amount2) * sign;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.credit_entity_sort_code2!,
        record.credit_entity2,
      );
      amount += recordAmount;
    }
    if (record.debit_entity1 && validation(record.debit_entity1, record.debit_entity_sort_code1!)) {
      const recordAmount = Number(record.debit_local_amount1) * sign * -1;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.debit_entity_sort_code1!,
        record.debit_entity1,
      );
      amount += recordAmount;
    }
    if (record.debit_entity2 && validation(record.debit_entity2, record.debit_entity_sort_code2!)) {
      const recordAmount = Number(record.debit_local_amount2) * sign * -1;
      updateRecords(
        amountsByEntity,
        recordAmount,
        record.debit_entity_sort_code2!,
        record.debit_entity2,
      );
      amount += recordAmount;
    }
  });

  const records = Array.from(amountsByEntity.entries()).map(([sortCode, data]) => ({
    sortCode,
    amount: data.amount,
    records: Array.from(data.records.entries()).map(([financialEntityId, amount]) => ({
      financialEntityId,
      amount,
    })),
  }));

  return { amount, records };
}

export function getProfitLossReportAmounts(decoratedLedgerRecords: DecoratedLedgerRecord[]) {
  const { amount: revenueAmount, records: revenueRecords } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => Math.floor(sortCode / 100) === 8,
  );

  const { amount: costOfSalesAmount, records: costOfSalesRecords } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => [910, 911, 912].includes(sortCode),
  );

  const grossProfitAmount = revenueAmount + costOfSalesAmount;

  const {
    amount: researchAndDevelopmentExpensesAmount,
    records: researchAndDevelopmentExpensesRecords,
  } = amountBySortCodeValidation(decoratedLedgerRecords, sortCode =>
    [920, 921, 922, 923, 924, 925, 930, 931].includes(sortCode),
  );

  const { amount: marketingExpensesAmount, records: marketingExpensesRecords } =
    amountBySortCodeValidation(decoratedLedgerRecords, sortCode => [935, 936].includes(sortCode));

  const {
    amount: managementAndGeneralExpensesAmount,
    records: managementAndGeneralExpensesRecords,
  } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode >= 940 && sortCode <= 948, // 940, 941, 942, 943, 944, 945, 947, 948
  );

  const operatingProfitAmount =
    grossProfitAmount +
    researchAndDevelopmentExpensesAmount +
    marketingExpensesAmount +
    managementAndGeneralExpensesAmount;

  const { amount: financialExpensesAmount, records: financialExpensesRecords } =
    amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => sortCode === 990 || sortCode === 991,
    );

  const { amount: otherIncomeAmount, records: otherIncomeRecords } = amountBySortCodeValidation(
    decoratedLedgerRecords,
    sortCode => sortCode === 995,
  );

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
