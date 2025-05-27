import { CommentaryProto } from '../types.js';
import { DecoratedLedgerRecord } from './profit-and-loss.helper.js';

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

export type FilteringRule = (financialEntityId: string, sortCode: number) => boolean;
export type FilteringOptions = {
  rule: FilteringRule;
  negate?: boolean;
};

export function amountByFinancialEntityIdAndSortCodeValidations<
  T extends FilteringOptions[],
  R extends { [K in keyof T]: number },
>(unfilteredRecords: DecoratedLedgerRecord[], filteringRules: T): R {
  const amounts = filteringRules.map(() => 0) as R;
  unfilteredRecords.map(record => {
    if (record.credit_entity1) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.credit_entity1, record.credit_entity_sort_code1!)) {
          amounts[i] += Number(record.credit_local_amount1) * (filteringRules[i].negate ? -1 : 1);
        }
      }
    }
    if (record.credit_entity2) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.credit_entity2, record.credit_entity_sort_code2!)) {
          amounts[i] += Number(record.credit_local_amount2) * (filteringRules[i].negate ? -1 : 1);
        }
      }
    }
    if (record.debit_entity1) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.debit_entity1, record.debit_entity_sort_code1!)) {
          amounts[i] += Number(record.debit_local_amount1) * (filteringRules[i].negate ? 1 : -1);
        }
      }
    }
    if (record.debit_entity2) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.debit_entity2, record.debit_entity_sort_code2!)) {
          amounts[i] += Number(record.debit_local_amount2) * (filteringRules[i].negate ? 1 : -1);
        }
      }
    }
  });

  return amounts;
}

export function recordsByFinancialEntityIdAndSortCodeValidations<
  T extends FilteringOptions[],
  R extends { [K in keyof T]: CommentaryProto },
>(unfilteredRecords: DecoratedLedgerRecord[], filteringRules: T): R {
  const commentaryProtos = filteringRules.map(() => ({
    amount: 0,
    amountsByEntity: new Map<
      number,
      {
        amount: number;
        records: Map<string, number>;
      }
    >(),
  }));
  unfilteredRecords.map(record => {
    if (record.credit_entity1) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.credit_entity1, record.credit_entity_sort_code1!)) {
          const sign = filteringRules[i].negate ? -1 : 1;
          const recordAmount = Number(record.credit_local_amount1) * sign;
          updateRecords(
            commentaryProtos[i].amountsByEntity,
            recordAmount,
            record.credit_entity_sort_code1!,
            record.credit_entity1,
          );
          commentaryProtos[i].amount += recordAmount;
        }
      }
    }
    if (record.credit_entity2) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.credit_entity2, record.credit_entity_sort_code2!)) {
          const sign = filteringRules[i].negate ? -1 : 1;
          const recordAmount = Number(record.credit_local_amount2) * sign;
          updateRecords(
            commentaryProtos[i].amountsByEntity,
            recordAmount,
            record.credit_entity_sort_code2!,
            record.credit_entity2,
          );
          commentaryProtos[i].amount += recordAmount;
        }
      }
    }
    if (record.debit_entity1) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.debit_entity1, record.debit_entity_sort_code1!)) {
          const sign = filteringRules[i].negate ? -1 : 1;
          const recordAmount = Number(record.debit_local_amount1) * sign * -1;
          updateRecords(
            commentaryProtos[i].amountsByEntity,
            recordAmount,
            record.debit_entity_sort_code1!,
            record.debit_entity1,
          );
          commentaryProtos[i].amount += recordAmount;
        }
      }
    }
    if (record.debit_entity2) {
      for (let i = 0; i < filteringRules.length; i++) {
        if (filteringRules[i].rule(record.debit_entity2, record.debit_entity_sort_code2!)) {
          const sign = filteringRules[i].negate ? -1 : 1;
          const recordAmount = Number(record.debit_local_amount2) * sign * -1;
          updateRecords(
            commentaryProtos[i].amountsByEntity,
            recordAmount,
            record.debit_entity_sort_code2!,
            record.debit_entity2,
          );
          commentaryProtos[i].amount += recordAmount;
        }
      }
    }
  });

  return commentaryProtos.map(proto => ({
    amount: proto.amount,
    records: Array.from(proto.amountsByEntity.entries()).map(([sortCode, data]) => ({
      sortCode,
      amount: data.amount,
      records: Array.from(data.records.entries()).map(([financialEntityId, amount]) => ({
        financialEntityId,
        amount,
      })),
    })),
  })) as R;
}
