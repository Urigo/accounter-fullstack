import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  calculateFifoCostBasis,
  type CostBasisExecution,
} from '../security-cost-basis.helper.js';

/*
 * FIFO purchase cost of the units a redemption (or a sale) takes out of its account's position,
 * replayed from the ingested executions of one security across the owner's accounts. All values
 * are made up.
 */

const USD_LABEL = 'דולר ארה"ב';
/** Two of the owner's portfolio accounts, at the same bank and branch */
const OLD_ACCOUNT = 111111;
const NEW_ACCOUNT = 222222;
const EUR_LABEL = 'אירו';

function execution(overrides: Partial<CostBasisExecution> & Pick<CostBasisExecution, 'id'>) {
  return {
    trade_date: '2024-01-10',
    trade_type: 'קניה',
    security: '1111111',
    nv: '10',
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    net_value_trade_currency: '-1000.00',
    net_value_settlement_currency: '-1000.00',
    net_value_nis: '-3700.00',
    is_cancel_transaction: 'לא',
    payment_type: null,
    trade_gross_value_trade_currency: null,
    bank_number: 12,
    branch_number: 600,
    account_number: OLD_ACCOUNT,
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

  it('drops a cancelled sale together with its cancellation, so it takes no lot', () => {
    const target = sell('s2', '2025-03-01', 10, 1300);
    const cancelled = sell('s1', '2024-06-01', 10, 1200);
    const cancellation = {
      ...sell('s1-cancel', '2024-06-03', 10, -1200),
      is_cancel_transaction: 'כן',
    };

    const result = calculateFifoCostBasis(
      [
        buy('b1', '2024-01-10', 10, 1000),
        buy('b2', '2024-02-10', 10, 1100),
        cancelled,
        cancellation,
        target,
      ],
      target,
      Currency.Usd,
    );

    // the cancelled sale never happened, so the oldest lot is still there to draw on
    expect(result.lots.map(lot => lot.executionId)).toEqual(['b1']);
    expect(result.costForeign).toBeCloseTo(1000, 6);
    expect(result.openingPositionUnknown).toBe(false);
  });

  it('drops a cancelled buy together with its cancellation, so it adds no lot', () => {
    const target = sell('s1', '2025-03-01', 10, 1300);

    const result = calculateFifoCostBasis(
      [
        buy('b1', '2024-01-10', 10, 900),
        { ...buy('b1-cancel', '2024-01-11', 10, -900), is_cancel_transaction: 'כן' },
        buy('b2', '2024-02-10', 10, 1100),
        target,
      ],
      target,
      Currency.Usd,
    );

    expect(result.lots.map(lot => lot.executionId)).toEqual(['b2']);
    expect(result.costForeign).toBeCloseTo(1100, 6);
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

  describe('lots, and transfers between the owner accounts', () => {
    const inNew = <T extends CostBasisExecution>(row: T): T => ({
      ...row,
      account_number: NEW_ACCOUNT,
    });

    /** Out of the old account, or into the new one unless another account is given */
    const transfer = (
      id: string,
      tradeDate: TimelessDateString,
      units: number,
      direction: 'in' | 'out',
      accountNumber = direction === 'in' ? NEW_ACCOUNT : OLD_ACCOUNT,
    ) =>
      execution({
        id,
        trade_date: tradeDate,
        trade_type: direction === 'in' ? 'העברה לזכות הפקדון' : 'העברה לחובת הפקדון',
        nv: String(units),
        net_value_trade_currency: '0',
        net_value_settlement_currency: '0',
        account_number: accountNumber,
      });

    it('lists the costed lots the units were drawn from, with their acquisitions', () => {
      const target = sell('s1', '2025-03-01', 15, 1800);

      const result = calculateFifoCostBasis(
        [buy('b1', '2024-01-10', 10, 1000), buy('b2', '2024-02-10', 10, 1200), target],
        target,
        Currency.Usd,
      );

      expect(result.lots).toEqual([
        { executionId: 'b1', tradeDate: '2024-01-10', units: 10, costForeign: 1000 },
        { executionId: 'b2', tradeDate: '2024-02-10', units: 5, costForeign: 600 },
      ]);
    });

    it('leaves lots with no known cost out of the list', () => {
      const target = sell('s1', '2025-03-01', 10, 1100);

      const result = calculateFifoCostBasis(
        [
          transfer('t1', '2024-01-05', 4, 'in', OLD_ACCOUNT),
          buy('b1', '2024-02-10', 6, 600),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.unknownCostUnits).toBe(4);
      expect(result.lots.map(lot => lot.executionId)).toEqual(['b1']);
    });

    it('carries lots moved between two accounts of the owner with their cost and place', () => {
      // bought in the old account, moved to the new one, where more was bought before it arrived
      const target = inNew(sell('s1', '2025-03-01', 12, 1500));

      const result = calculateFifoCostBasis(
        [
          buy('b1', '2024-01-10', 10, 1000),
          transfer('out', '2024-06-01', 10, 'out'),
          inNew(buy('b2', '2024-06-02', 10, 1500)),
          transfer('in', '2024-06-03', 10, 'in'),
          target,
        ],
        target,
        Currency.Usd,
      );

      // the moved lot takes its purchase-order place, ahead of the new account's own later buy:
      // all 10 of it (1,000), then 2 of the later buy (300)
      expect(result.unknownCostUnits).toBe(0);
      expect(result.openingPositionUnknown).toBe(false);
      expect(result.costForeign).toBeCloseTo(1300, 6);
      expect(result.lots.map(lot => [lot.executionId, lot.units])).toEqual([
        ['b1', 10],
        ['b2', 2],
      ]);
    });

    it('pairs a transfer out with the transfer in of the same day', () => {
      const target = inNew(sell('s1', '2025-03-01', 10, 1100));

      const result = calculateFifoCostBasis(
        // the ids would put the transfer in first
        [
          buy('b1', '2024-01-10', 10, 1000),
          transfer('a-in', '2024-06-01', 10, 'in'),
          transfer('z-out', '2024-06-01', 10, 'out'),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.unknownCostUnits).toBe(0);
      expect(result.costForeign).toBeCloseTo(1000, 6);
    });

    it('does not take an unrelated, later transfer in for the arrival of a transfer out', () => {
      // units given away in March; months later, units of the same security arrive from elsewhere
      const target = inNew(sell('s1', '2025-03-01', 5, 600));

      const result = calculateFifoCostBasis(
        [
          buy('b1', '2024-01-10', 5, 500),
          transfer('out', '2024-03-01', 5, 'out'),
          transfer('in', '2024-09-01', 5, 'in'),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.unknownCostUnits).toBe(5);
      expect(result.lots).toEqual([]);
    });

    it('does not pair transfers of different units', () => {
      const target = inNew(sell('s1', '2025-03-01', 10, 1100));

      const result = calculateFifoCostBasis(
        [
          buy('b1', '2024-01-10', 10, 1000),
          transfer('out', '2024-06-01', 10, 'out'),
          transfer('in', '2024-06-02', 8, 'in'),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.unknownCostUnits).toBe(8);
      expect(result.missingUnits).toBe(2);
    });

    it('does not pair a transfer back into the account it left', () => {
      const target = sell('s1', '2025-03-01', 10, 1100);

      const result = calculateFifoCostBasis(
        [
          buy('b1', '2024-01-10', 10, 1000),
          transfer('out', '2024-06-01', 10, 'out'),
          transfer('in', '2024-06-02', 10, 'in', OLD_ACCOUNT),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.unknownCostUnits).toBe(10);
    });

    it('treats units transferred out and never back as gone', () => {
      const target = sell('s1', '2025-03-01', 5, 600);

      const result = calculateFifoCostBasis(
        [
          buy('b1', '2024-01-10', 5, 500),
          transfer('out', '2024-03-01', 5, 'out'),
          buy('b2', '2024-04-10', 5, 550),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.costForeign).toBeCloseTo(550, 6);
      expect(result.lots.map(lot => lot.executionId)).toEqual(['b2']);
    });

    it('lets a same-day buy cover a sale, whatever their ids', () => {
      const target = sell('a-sell', '2025-03-01', 5, 600);

      const result = calculateFifoCostBasis(
        [buy('z-buy', '2025-03-01', 5, 500), target],
        target,
        Currency.Usd,
      );

      expect(result.coveredUnits).toBe(5);
      expect(result.costForeign).toBeCloseTo(500, 6);
    });
  });

  describe('per account', () => {
    const inAccount = <T extends CostBasisExecution>(row: T, accountNumber: number): T => ({
      ...row,
      account_number: accountNumber,
    });
    const old = <T extends CostBasisExecution>(row: T) => inAccount(row, OLD_ACCOUNT);
    const neu = <T extends CostBasisExecution>(row: T) => inAccount(row, NEW_ACCOUNT);
    const moveToNew = (id: string, tradeDate: TimelessDateString, units: number) => [
      old(
        execution({
          id: `${id}-out`,
          trade_date: tradeDate,
          trade_type: 'העברה לחובת הפקדון',
          nv: String(units),
          net_value_trade_currency: '0',
          net_value_settlement_currency: '0',
        }),
      ),
      neu(
        execution({
          id: `${id}-in`,
          trade_date: tradeDate,
          trade_type: 'העברה לזכות הפקדון',
          nv: String(units),
          net_value_trade_currency: '0',
          net_value_settlement_currency: '0',
        }),
      ),
    ];

    it('draws a sale only on the lots of its own account', () => {
      const target = neu(sell('s1', '2025-02-01', 10, 1700));

      const result = calculateFifoCostBasis(
        [
          old(buy('b-old', '2023-03-01', 10, 1000)),
          neu(buy('b-new', '2024-05-01', 10, 1500)),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.costForeign).toBeCloseTo(1500, 6);
      expect(result.lots.map(lot => lot.executionId)).toEqual(['b-new']);
    });

    it("leaves another account's lots for that account's own sale", () => {
      const target = old(sell('s-old', '2025-06-01', 10, 1600));

      const result = calculateFifoCostBasis(
        [
          old(buy('b-old', '2023-03-01', 10, 1000)),
          neu(buy('b-new', '2024-05-01', 10, 1500)),
          neu(sell('s-new', '2025-02-01', 10, 1700)),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.costForeign).toBeCloseTo(1000, 6);
      expect(result.lots.map(lot => lot.executionId)).toEqual(['b-old']);
    });

    it("places moved lots by purchase date among the receiving account's own lots", () => {
      const target = neu(sell('s1', '2025-06-01', 30, 4000));

      const result = calculateFifoCostBasis(
        [
          neu(buy('b-2023', '2023-02-01', 10, 1000)),
          old(buy('b-2024-01', '2024-01-10', 10, 1100)),
          neu(buy('b-2024-06', '2024-06-10', 10, 1200)),
          ...moveToNew('move', '2025-01-15', 10),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.lots.map(lot => lot.executionId)).toEqual([
        'b-2023',
        'b-2024-01',
        'b-2024-06',
      ]);
      expect(result.costForeign).toBeCloseTo(3300, 6);
    });

    it('does not flag a sale for a gap in another account', () => {
      const target = neu(sell('s-new', '2024-06-01', 5, 600));

      const result = calculateFifoCostBasis(
        [
          old(sell('s-old', '2024-01-05', 5, 500)),
          neu(buy('b-new', '2024-02-10', 5, 500)),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.openingPositionUnknown).toBe(false);
      expect(result.costForeign).toBeCloseTo(500, 6);
    });

    it('flags the receiving account of a transfer out larger than its source held', () => {
      const target = neu(sell('s1', '2025-03-01', 10, 1100));

      const result = calculateFifoCostBasis(
        [old(buy('b1', '2024-01-10', 5, 500)), ...moveToNew('move', '2024-06-01', 10), target],
        target,
        Currency.Usd,
      );

      expect(result.openingPositionUnknown).toBe(true);
    });

    it('flags the receiving account of lots from a source whose history starts mid-position', () => {
      const target = neu(sell('s1', '2025-03-01', 10, 1100));

      const result = calculateFifoCostBasis(
        [
          old(sell('s-old', '2024-01-05', 5, 500)),
          old(buy('b1', '2024-02-10', 10, 1000)),
          ...moveToNew('move', '2024-06-01', 10),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.openingPositionUnknown).toBe(true);
    });

    it("dates the history from the sale's own account", () => {
      const target = neu(sell('s1', '2025-03-01', 5, 600));

      const result = calculateFifoCostBasis(
        [
          old(buy('b-old', '2022-05-01', 5, 400)),
          neu(buy('b-new', '2024-03-01', 5, 500)),
          target,
        ],
        target,
        Currency.Usd,
      );

      expect(result.historyStartDate).toBe('2024-03-01');
    });
  });
});
