import { describe, expect, it } from 'vitest';
import type { IGetAllFinancialEntitiesResult } from '../../../financial-entities/types.js';
import type { IGetLedgerRecordsByDatesResult } from '../../../ledger/types.js';
import { groupLedgerRecordsByIrsCode } from '../irs-codes-report.helper.js';

type Entity = Pick<IGetAllFinancialEntitiesResult, 'id' | 'name' | 'irs_code'>;

const REVENUE_A: Entity = { id: 'revenue-a', name: 'Revenue A', irs_code: 1010 };
const REVENUE_B: Entity = { id: 'revenue-b', name: 'Another revenue', irs_code: 1010 };
const EXPENSE: Entity = { id: 'expense', name: 'Expense', irs_code: 3011 };
const BANK: Entity = { id: 'bank', name: 'Bank', irs_code: null };

const entitiesById = new Map(
  [REVENUE_A, REVENUE_B, EXPENSE, BANK].map(entity => [entity.id, entity]),
);

function makeRecord(
  overrides: Partial<IGetLedgerRecordsByDatesResult>,
): IGetLedgerRecordsByDatesResult {
  return {
    id: 'record',
    charge_id: 'charge',
    owner_id: 'owner',
    credit_entity1: null,
    credit_entity2: null,
    credit_local_amount1: null,
    credit_local_amount2: null,
    credit_foreign_amount1: null,
    credit_foreign_amount2: null,
    debit_entity1: null,
    debit_entity2: null,
    debit_local_amount1: null,
    debit_local_amount2: null,
    debit_foreign_amount1: null,
    debit_foreign_amount2: null,
    currency: 'ILS',
    invoice_date: '2025-01-01',
    value_date: '2025-01-01',
    description: null,
    reference1: null,
    ...overrides,
  } as IGetLedgerRecordsByDatesResult;
}

describe('groupLedgerRecordsByIrsCode', () => {
  it('sums credit minus debit per entity and per code, misc last', () => {
    const records = [
      makeRecord({
        id: 'r1',
        invoice_date: '2025-03-01',
        credit_entity1: REVENUE_A.id,
        credit_local_amount1: '100',
        debit_entity1: BANK.id,
        debit_local_amount1: '100',
      }),
      makeRecord({
        id: 'r2',
        invoice_date: '2025-02-01',
        credit_entity1: REVENUE_B.id,
        credit_local_amount1: '50',
        debit_entity1: BANK.id,
        debit_local_amount1: '50',
      }),
      makeRecord({
        id: 'r3',
        credit_entity1: BANK.id,
        credit_local_amount1: '30',
        debit_entity1: EXPENSE.id,
        debit_local_amount1: '30',
      }),
    ];

    const groups = groupLedgerRecordsByIrsCode(records, entitiesById);

    expect(groups.map(group => [group.irsCode, group.amount])).toEqual([
      [1010, 150],
      [3011, -30],
      [null, -120],
    ]);

    // entities sorted by name
    expect(groups[0].entities.map(entity => [entity.financialEntityId, entity.amount])).toEqual([
      [REVENUE_B.id, 50],
      [REVENUE_A.id, 100],
    ]);

    // bank ledger records sorted by invoice date
    expect(groups[2].entities[0].ledgerRecords.map(record => record.id)).toEqual([
      'r3',
      'r2',
      'r1',
    ]);
  });

  it('lists a record once when it touches the same entity on several slots', () => {
    const records = [
      makeRecord({
        id: 'r1',
        credit_entity1: EXPENSE.id,
        credit_local_amount1: '10',
        debit_entity1: EXPENSE.id,
        debit_local_amount1: '25',
        credit_entity2: BANK.id,
        credit_local_amount2: '15',
      }),
    ];

    const [expenseGroup] = groupLedgerRecordsByIrsCode(records, entitiesById);

    expect(expenseGroup.irsCode).toBe(3011);
    expect(expenseGroup.amount).toBe(-15);
    expect(expenseGroup.entities[0].ledgerRecords).toHaveLength(1);
  });

  it('puts unknown entities in the misc group', () => {
    const records = [
      makeRecord({ id: 'r1', credit_entity1: 'unknown', credit_local_amount1: '5' }),
    ];

    expect(groupLedgerRecordsByIrsCode(records, entitiesById)).toEqual([
      {
        irsCode: null,
        amount: 5,
        entities: [{ financialEntityId: 'unknown', amount: 5, ledgerRecords: records }],
      },
    ]);
  });
});
