import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  assignSecurityTransactionOccurrences,
  dropRepeatedSecurityTransactions,
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

describe('dropRepeatedSecurityTransactions', () => {
  it('drops a row repeated verbatim', () => {
    expect(dropRepeatedSecurityTransactions([execution, { ...execution }])).toEqual([execution]);
  });

  it('keeps rows that differ in any field', () => {
    expect(dropRepeatedSecurityTransactions([execution, { ...execution, tradePrice: 101 }])).toHaveLength(2);
  });
});

describe('assignSecurityTransactionOccurrences', () => {
  /** A stored row of the same group, as pg returns it. */
  const stored = (occurrence: number, tradePrice: number) => ({
    bank_number: 12,
    branch_number: 615,
    account_number: 100000,
    security: '1234567',
    trade_date: '2024-01-15' as TimelessDateString,
    trade_type: 'קניה',
    transaction_type: 'קניה',
    nv: '10',
    payment_type: null,
    payment_date: null,
    ex_date: null,
    cancel_date: null,
    occurrence,
    trade_price: String(tradePrice),
    net_value_trade_currency: String(-10 * tradePrice),
  });

  const occurrencesOf = (rows: Array<{ tradePrice: number; occurrence: number }>) =>
    rows.map(r => [r.tradePrice, r.occurrence]);

  it('numbers each distinct execution 1 when nothing shares its key', () => {
    const result = assignSecurityTransactionOccurrences([execution, { ...execution, nv: 20 }], []);
    expect(result.map(r => r.occurrence)).toEqual([1, 1]);
  });

  it('numbers new same-key executions by price', () => {
    const result = assignSecurityTransactionOccurrences(
      [
        { ...execution, tradePrice: 102 },
        { ...execution, tradePrice: 101 },
      ],
      [],
    );
    expect(occurrencesOf(result)).toEqual([
      [101, 1],
      [102, 2],
    ]);
  });

  it('lands a restatement on the row it restates', () => {
    const result = assignSecurityTransactionOccurrences(
      [{ ...execution, tradePrice: 100.4, netValueTradeCurrency: -1004 }],
      [stored(1, 100)],
    );
    expect(result.map(r => r.occurrence)).toEqual([1]);
  });

  it('keeps the stored ordinal of each execution in a partial upload', () => {
    const result = assignSecurityTransactionOccurrences(
      [{ ...execution, tradePrice: 101, netValueTradeCurrency: -1010 }],
      [stored(1, 100), stored(2, 101)],
    );
    expect(occurrencesOf(result)).toEqual([[101, 2]]);
  });

  it('gives an execution the stored set lacks the next free ordinal', () => {
    const result = assignSecurityTransactionOccurrences(
      [
        { ...execution, tradePrice: 99, netValueTradeCurrency: -990 },
        { ...execution, tradePrice: 100, netValueTradeCurrency: -1000 },
      ],
      [stored(1, 100)],
    );
    expect(occurrencesOf(result)).toEqual([
      [99, 2],
      [100, 1],
    ]);
  });

  it('pairs restated executions with their nearest stored versions', () => {
    const result = assignSecurityTransactionOccurrences(
      [
        { ...execution, tradePrice: 101.1, netValueTradeCurrency: -1011 },
        { ...execution, tradePrice: 100.1, netValueTradeCurrency: -1001 },
      ],
      [stored(1, 100), stored(2, 101)],
    );
    expect(occurrencesOf(result)).toEqual([
      [100.1, 1],
      [101.1, 2],
    ]);
  });
});
