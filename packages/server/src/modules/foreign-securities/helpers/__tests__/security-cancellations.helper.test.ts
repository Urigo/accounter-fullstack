import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  pairCancellations,
  type CancellableExecution,
} from '../security-cancellations.helper.js';

/*
 * Pairing the bank's cancellation rows with the executions they cancel. All values are made up.
 */

const SELL = 'מכירה';
const BUY = 'קניה';

function execution(
  id: string,
  tradeDate: TimelessDateString,
  overrides: Partial<CancellableExecution> = {},
): CancellableExecution {
  return {
    id,
    trade_date: tradeDate,
    trade_type: SELL,
    security: '1111111',
    is_cancel_transaction: 'לא',
    trade_gross_value_trade_currency: '1000',
    net_value_trade_currency: '990',
    bank_number: 12,
    branch_number: 600,
    account_number: 111111,
    ...overrides,
  };
}

const cancellationOf = (id: string, tradeDate: TimelessDateString, overrides = {}) =>
  execution(id, tradeDate, {
    is_cancel_transaction: 'כן',
    net_value_trade_currency: '-990',
    ...overrides,
  });

describe('pairCancellations', () => {
  it('drops a cancellation together with the execution it cancels', () => {
    const original = execution('s1', '2025-02-01');
    const other = execution('s2', '2025-02-05', { trade_gross_value_trade_currency: '2000' });
    const cancellation = cancellationOf('c1', '2025-02-03');

    const result = pairCancellations([original, other, cancellation]);

    expect(result.live.map(e => e.id)).toEqual(['s2']);
    expect(result.pairs).toEqual([{ original, cancellation }]);
    expect(result.orphanCancellations).toEqual([]);
  });

  it('pairs with the latest matching execution at or before the cancellation', () => {
    const older = execution('s1', '2025-01-10');
    const newer = execution('s2', '2025-02-01');
    const later = execution('s3', '2025-03-01');
    const cancellation = cancellationOf('c1', '2025-02-01');

    const result = pairCancellations([older, newer, later, cancellation]);

    expect(result.pairs.map(pair => pair.original.id)).toEqual(['s2']);
    expect(result.live.map(e => e.id)).toEqual(['s1', 's3']);
  });

  it('cancels each original once', () => {
    const first = execution('s1', '2025-01-10');
    const second = execution('s2', '2025-01-20');

    const result = pairCancellations([
      first,
      second,
      cancellationOf('c1', '2025-02-01'),
      cancellationOf('c2', '2025-02-02'),
    ]);

    expect(result.pairs.map(pair => [pair.original.id, pair.cancellation.id])).toEqual([
      ['s2', 'c1'],
      ['s1', 'c2'],
    ]);
    expect(result.live).toEqual([]);
  });

  it('requires the same trade type, security, account and amount', () => {
    const result = pairCancellations([
      execution('buy', '2025-01-10', { trade_type: BUY }),
      execution('other-security', '2025-01-10', { security: '2222222' }),
      execution('other-account', '2025-01-10', { account_number: 222222 }),
      execution('other-amount', '2025-01-10', { trade_gross_value_trade_currency: '1500' }),
      cancellationOf('c1', '2025-02-01'),
    ]);

    expect(result.pairs).toEqual([]);
    expect(result.orphanCancellations.map(e => e.id)).toEqual(['c1']);
    expect(result.live.map(e => e.id)).toEqual([
      'buy',
      'other-security',
      'other-account',
      'other-amount',
    ]);
  });

  it('pairs within the security when two securities share an amount', () => {
    const bondA = execution('a', '2025-03-01', { security: '2222222' });
    const bondB = execution('b', '2025-03-02', { security: '3333333' });
    const cancellationOfA = cancellationOf('c1', '2025-03-03', { security: '2222222' });

    const result = pairCancellations([bondA, bondB, cancellationOfA]);

    expect(result.pairs).toEqual([{ original: bondA, cancellation: cancellationOfA }]);
    expect(result.live.map(e => e.id)).toEqual(['b']);
  });

  it('matches on the net amount when the gross is not reported', () => {
    const original = execution('s1', '2025-01-10', { trade_gross_value_trade_currency: null });
    const cancellation = cancellationOf('c1', '2025-01-12', {
      trade_gross_value_trade_currency: null,
    });

    expect(pairCancellations([original, cancellation]).pairs).toEqual([
      { original, cancellation },
    ]);
  });

  it('never pairs with an execution after the cancellation', () => {
    const result = pairCancellations([
      cancellationOf('c1', '2025-01-01'),
      execution('s1', '2025-01-02'),
    ]);

    expect(result.orphanCancellations.map(e => e.id)).toEqual(['c1']);
    expect(result.live.map(e => e.id)).toEqual(['s1']);
  });
});
