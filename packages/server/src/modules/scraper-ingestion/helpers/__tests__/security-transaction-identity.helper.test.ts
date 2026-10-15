import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  assignSecurityTransactionOccurrences,
  securityTransactionGroupKeyOf,
  securityTransactionKeyOf,
} from '../security-transaction-identity.helper.js';

const execution = {
  bankNumber: 12,
  branchNumber: 615,
  accountNumber: 100000,
  security: '1234567',
  tradeDate: '2024-01-15' as TimelessDateString,
  valueDate: '2024-01-16' as TimelessDateString,
  tradeType: 'קניה',
  transactionType: 'קניה',
  nv: 10,
  tradePrice: 100,
  netValueTradeCurrency: -1000,
  paymentType: null,
  paymentDate: null,
  exDate: null,
  cancelDate: null,
};

describe('securityTransactionGroupKeyOf', () => {
  it('ignores the fields the bank restates on settlement', () => {
    const settled = {
      ...execution,
      valueDate: '2024-01-18' as TimelessDateString,
      tradePrice: 100.5,
      netValueTradeCurrency: -1005,
    };
    expect(securityTransactionGroupKeyOf(settled)).toBe(securityTransactionGroupKeyOf(execution));
  });

  it('matches a pg row (snake_case, NUMERIC as string) to its payload row', () => {
    expect(
      securityTransactionKeyOf({
        bank_number: 12,
        branch_number: 615,
        account_number: 100000,
        security: '1234567',
        trade_date: '2024-01-15' as TimelessDateString,
        trade_type: 'קניה',
        transaction_type: 'קניה',
        nv: '10.00',
        payment_type: null,
        payment_date: null,
        ex_date: null,
        cancel_date: null,
        occurrence: 1,
      }),
    ).toBe(securityTransactionKeyOf({ ...execution, occurrence: 1 }));
  });

  it('separates executions that differ in direction or size', () => {
    const key = securityTransactionGroupKeyOf(execution);
    expect(securityTransactionGroupKeyOf({ ...execution, tradeType: 'מכירה' })).not.toBe(key);
    expect(securityTransactionGroupKeyOf({ ...execution, nv: 11 })).not.toBe(key);
  });
});

describe('assignSecurityTransactionOccurrences', () => {
  it('numbers each distinct execution 1 when nothing shares its key', () => {
    const result = assignSecurityTransactionOccurrences([execution, { ...execution, nv: 20 }]);
    expect(result.map(r => r.occurrence)).toEqual([1, 1]);
  });

  it('numbers same-key executions by price', () => {
    const result = assignSecurityTransactionOccurrences([
      { ...execution, tradePrice: 102 },
      { ...execution, tradePrice: 101 },
    ]);
    expect(result.map(r => [r.tradePrice, r.occurrence])).toEqual([
      [101, 1],
      [102, 2],
    ]);
  });

  it('drops a row repeated verbatim', () => {
    expect(assignSecurityTransactionOccurrences([execution, { ...execution }])).toEqual([
      { ...execution, occurrence: 1 },
    ]);
  });
});
