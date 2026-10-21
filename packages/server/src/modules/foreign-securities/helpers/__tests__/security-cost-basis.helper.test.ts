import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  calculateFifoCostBasis,
  type CostBasisExecution,
} from '../security-cost-basis.helper.js';

/*
 * FIFO purchase cost of the units a redemption (or a sale) takes out of a position, replayed from
 * the ingested executions of one security in one account. All values are made up.
 */

const USD_LABEL = 'דולר ארה"ב';
const EUR_LABEL = 'אירו';

function execution(overrides: Partial<CostBasisExecution> & Pick<CostBasisExecution, 'id'>) {
  return {
    trade_date: '2024-01-10',
    trade_type: 'קניה',
    nv: '10',
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    net_value_trade_currency: '-1000.00',
    net_value_settlement_currency: '-1000.00',
    net_value_nis: '-3700.00',
    is_cancel_transaction: 'לא',
    payment_type: null,
    trade_gross_value_trade_currency: null,
    ...overrides,
  } satisfies CostBasisExecution;
}

const buy = (id: string, tradeDate: TimelessDateString, units: number, cost: number) =>
  execution({
    id,
    trade_date: tradeDate,
    nv: String(units),
    net_value_trade_currency: String(-cost),
    net_value_settlement_currency: String(-cost),
  });

const sell = (id: string, tradeDate: TimelessDateString, units: number, proceeds: number) =>
  execution({
    id,
    trade_date: tradeDate,
    trade_type: 'מכירה',
    nv: String(units),
    net_value_trade_currency: String(proceeds),
    net_value_settlement_currency: String(proceeds),
  });

const redemption = (id: string, tradeDate: TimelessDateString, units: number, proceeds: number) =>
  execution({
    id,
    trade_date: tradeDate,
    trade_type: 'פדיון',
    nv: String(units),
    net_value_trade_currency: String(proceeds),
    net_value_settlement_currency: String(proceeds),
  });

describe('calculateFifoCostBasis', () => {
  it('costs a fully redeemed single lot at what was paid for it', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-01-10', 10, 1000), target],
      target,
      Currency.Usd,
    );

    expect(result.redeemedUnits).toBe(10);
    expect(result.coveredUnits).toBe(10);
    expect(result.costForeign).toBeCloseTo(1000, 6);
    expect(result.missingUnits).toBe(0);
    expect(result.unknownCostUnits).toBe(0);
    expect(result.historyStartDate).toBe('2024-01-10');
    expect(result.openingPositionUnknown).toBe(false);
  });

  it('consumes the oldest lots first, splitting a lot when needed', () => {
    const target = redemption('r1', '2025-03-01', 15, 1600);

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-01-10', 10, 1000), buy('b2', '2024-02-10', 10, 1200), target],
      target,
      Currency.Usd,
    );

    // all 10 units of the first lot (1,000) and 5 of the second (5 × 120 = 600)
    expect(result.costForeign).toBeCloseTo(1600, 6);
    expect(result.coveredUnits).toBe(15);
  });

  it('lets earlier sales and redemptions use up the oldest lots before this one', () => {
    const target = redemption('r2', '2025-03-01', 12, 1500);

    const result = calculateFifoCostBasis(
      [
        buy('b1', '2024-01-10', 10, 1000),
        buy('b2', '2024-02-10', 10, 1200),
        sell('s1', '2024-03-10', 5, 600),
        redemption('r1', '2024-06-10', 3, 330),
        target,
      ],
      target,
      Currency.Usd,
    );

    // 8 units of the first lot are gone; 2 left (200) plus 10 of the second (1,200)
    expect(result.costForeign).toBeCloseTo(1400, 6);
    expect(result.coveredUnits).toBe(12);
  });

  it('replays by trade date and then id, whatever order the rows come in', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [target, buy('b2', '2024-02-10', 10, 1200), buy('b1', '2024-01-10', 10, 1000)],
      target,
      Currency.Usd,
    );

    expect(result.costForeign).toBeCloseTo(1000, 6);
  });

  it('ignores everything after the redemption', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-01-10', 5, 500), target, buy('b2', '2025-04-01', 10, 900)],
      target,
      Currency.Usd,
    );

    expect(result.coveredUnits).toBe(5);
    expect(result.missingUnits).toBe(5);
  });

  it('skips cancelled executions', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [
        { ...buy('b0', '2024-01-01', 10, 800), is_cancel_transaction: 'כן' },
        buy('b1', '2024-01-10', 10, 1000),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.costForeign).toBeCloseTo(1000, 6);
  });

  it('ignores cash-only actions such as dividends and interest', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [
        buy('b1', '2024-01-10', 10, 1000),
        execution({
          id: 'i1',
          trade_date: '2024-07-01',
          trade_type: 'ריבית תשלום',
          nv: '0',
          net_value_trade_currency: '50',
          net_value_settlement_currency: '50',
        }),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.costForeign).toBeCloseTo(1000, 6);
    expect(result.coveredUnits).toBe(10);
  });

  it('reports units drawn from lots with no known cost (transfers in, distributions)', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [
        execution({
          id: 't1',
          trade_type: 'העברה לזכות הפקדון',
          nv: '6',
          net_value_trade_currency: '0',
          net_value_settlement_currency: '0',
        }),
        buy('b1', '2024-02-10', 4, 400),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.unknownCostUnits).toBe(6);
    expect(result.coveredUnits).toBe(4);
    expect(result.costForeign).toBeCloseTo(400, 6);
  });

  it('costs units received as a dividend in kind at their gross value', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [
        buy('b1', '2024-02-10', 4, 400),
        execution({
          id: 'd1',
          trade_date: '2024-06-10',
          trade_type: 'הטבה חלוקת מניות',
          payment_type: 'דיבידנד בעין',
          nv: '6',
          trade_gross_value_trade_currency: '720',
          // a distribution's net value is its commission, never its cost
          net_value_trade_currency: '0',
          net_value_settlement_currency: '-2',
        }),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.unknownCostUnits).toBe(0);
    expect(result.coveredUnits).toBe(10);
    expect(result.costForeign).toBeCloseTo(1120, 6);
  });

  it('leaves units of another distribution, or of one in another currency, without cost', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);
    const distribution = (id: string, overrides: Partial<CostBasisExecution>) =>
      execution({
        id,
        trade_date: '2024-06-10',
        trade_type: 'הטבה חלוקת מניות',
        nv: '5',
        trade_gross_value_trade_currency: '600',
        net_value_trade_currency: '0',
        net_value_settlement_currency: '0',
        ...overrides,
      });

    const result = calculateFifoCostBasis(
      [
        distribution('d1', { payment_type: null }),
        distribution('d2', {
          payment_type: 'דיבידנד בעין',
          trade_currency: EUR_LABEL,
          settlement_currency: EUR_LABEL,
        }),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.unknownCostUnits).toBe(10);
    expect(result.coveredUnits).toBe(0);
  });

  it('reports the units the ingested history does not cover', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-05-10', 4, 400), target],
      target,
      Currency.Usd,
    );

    expect(result.coveredUnits).toBe(4);
    expect(result.missingUnits).toBe(6);
    expect(result.historyStartDate).toBe('2024-05-10');
  });

  it('treats a lot bought in another currency as having no known cost in this one', () => {
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [
        execution({
          id: 'b1',
          trade_currency: EUR_LABEL,
          settlement_currency: EUR_LABEL,
          net_value_trade_currency: '-900',
          net_value_settlement_currency: '-900',
        }),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.unknownCostUnits).toBe(10);
    expect(result.coveredUnits).toBe(0);
  });

  it('flags a history that starts mid-position, ahead of every observed lot', () => {
    // units held from before the scraped history: 5 of them are sold before any buy is seen, so
    // an opening holding of unknown size and cost comes first in FIFO order
    const target = redemption('r1', '2025-03-01', 10, 1100);

    const result = calculateFifoCostBasis(
      [sell('s1', '2024-01-05', 5, 500), buy('b1', '2024-02-10', 10, 1000), target],
      target,
      Currency.Usd,
    );

    expect(result.openingPositionUnknown).toBe(true);
  });

  it('does not flag sales the observed lots cover', () => {
    const target = redemption('r1', '2025-03-01', 5, 550);

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-01-10', 10, 1000), sell('s1', '2024-02-10', 5, 600), target],
      target,
      Currency.Usd,
    );

    expect(result.openingPositionUnknown).toBe(false);
  });

  it('takes nothing out for a cancelled redemption', () => {
    const target = { ...redemption('r1', '2025-03-01', 10, 1100), is_cancel_transaction: 'כן' };

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-01-10', 10, 1000), target],
      target,
      Currency.Usd,
    );

    expect(result.redeemedUnits).toBe(0);
    expect(result.coveredUnits).toBe(0);
  });

  it('reports zero redeemed units when the execution carries none', () => {
    const target = redemption('r1', '2025-03-01', 0, 1100);

    const result = calculateFifoCostBasis(
      [buy('b1', '2024-01-10', 10, 1000), target],
      target,
      Currency.Usd,
    );

    expect(result.redeemedUnits).toBe(0);
    expect(result.coveredUnits).toBe(0);
  });
});
