import { describe, expect, it } from 'vitest';
import type { SecurityExecutionRow } from '../../types.js';
import {
  calculateDisposalPnL,
  compareWithBankProfitLoss,
  costBasisProblem,
  getExecutionBankRate,
  lastRevaluationOver,
  lowerOfTwo,
} from '../security-disposal.helper.js';

/*
 * The arithmetic of a disposal out of FIFO lots. All values are made up.
 */

describe('calculateDisposalPnL', () => {
  it('splits the local PnL of a single lot into price and rate PnL', () => {
    // 400 units bought at 1.00 when the dollar was 3.80, sold at 1.02 when it was 3.60
    const pnl = calculateDisposalPnL({
      proceedsForeign: 408,
      saleRate: 3.6,
      lots: [{ units: 400, costForeign: 400, rate: 3.8 }],
    });

    expect(pnl.originCurrencyPnL).toBeCloseTo(8, 6);
    expect(pnl.pricePnL).toBeCloseTo(28.8, 6);
    expect(pnl.ratePnL).toBeCloseTo(-80, 6);
    expect(pnl.localPnL).toBeCloseTo(-51.2, 6);
    expect(pnl.pricePnL + pnl.ratePnL).toBeCloseTo(pnl.localPnL, 6);
    expect(pnl.costLocal).toBeCloseTo(1520, 6);
    expect(pnl.proceedsLocal).toBeCloseTo(1468.8, 6);
  });

  it('breaks the PnL down by lot, sharing the proceeds by units', () => {
    const pnl = calculateDisposalPnL({
      proceedsForeign: 480,
      saleRate: 3.6,
      lots: [
        { units: 10, costForeign: 100, rate: 3.5 },
        { units: 30, costForeign: 330, rate: 3.7 },
      ],
    });

    expect(pnl.lots.map(lot => lot.proceedsForeign)).toEqual([120, 360]);
    expect(pnl.lots[0]!.ratePnL).toBeCloseTo(10, 6);
    expect(pnl.lots[0]!.localPnL).toBeCloseTo(82, 6);
    expect(pnl.lots[1]!.ratePnL).toBeCloseTo(-33, 6);
    expect(pnl.lots[1]!.localPnL).toBeCloseTo(75, 6);
    expect(pnl.originCurrencyPnL).toBeCloseTo(50, 6);
    expect(pnl.pricePnL).toBeCloseTo(180, 6);
    expect(pnl.ratePnL).toBeCloseTo(-23, 6);
    expect(pnl.localPnL).toBeCloseTo(157, 6);
  });

  it('has no rate PnL in the local currency', () => {
    const pnl = calculateDisposalPnL({
      proceedsForeign: 1100,
      saleRate: 1,
      lots: [{ units: 10, costForeign: 1000, rate: 1 }],
    });

    expect(pnl.ratePnL).toBe(0);
    expect(pnl.localPnL).toBeCloseTo(100, 6);
  });
});

describe('lastRevaluationOver', () => {
  const revaluations = ['2022-12-31', '2023-12-31', '2024-12-31'] as const;

  it('is the latest revaluation between the booking and the disposal', () => {
    expect(lastRevaluationOver('2022-05-01', '2025-03-01', revaluations)).toBe('2024-12-31');
    expect(lastRevaluationOver('2024-12-31', '2025-03-01', revaluations)).toBe('2024-12-31');
    expect(lastRevaluationOver('2022-05-01', '2024-06-01', revaluations)).toBe('2023-12-31');
  });

  it('is null for a lot booked after the last revaluation', () => {
    expect(lastRevaluationOver('2025-01-10', '2025-03-01', revaluations)).toBeNull();
  });

  it('ignores a revaluation on the day of the disposal, which no longer held the lot', () => {
    expect(lastRevaluationOver('2024-06-01', '2024-12-31', revaluations)).toBeNull();
    expect(lastRevaluationOver('2023-06-01', '2024-12-31', revaluations)).toBe('2023-12-31');
  });

  it('is null when the year-end was never revalued', () => {
    expect(lastRevaluationOver('2024-05-01', '2025-03-01', ['2023-12-31'])).toBeNull();
  });
});

describe('getExecutionBankRate', () => {
  it("reads the bank's own rate when it reports one", () => {
    expect(
      getExecutionBankRate({
        personal_currency_rate: '3.7',
        trade_gross_value_trade_currency: '100',
        trade_gross_value_nis: '380',
      }),
    ).toEqual({ rate: 3.7, derived: false });
  });

  it('derives it from the gross values otherwise', () => {
    expect(
      getExecutionBankRate({
        personal_currency_rate: '-1',
        trade_gross_value_trade_currency: '-100',
        trade_gross_value_nis: '-370',
      }),
    ).toEqual({ rate: 3.7, derived: true });
  });

  it('is null when there is neither', () => {
    expect(
      getExecutionBankRate({
        personal_currency_rate: '-1',
        trade_gross_value_trade_currency: '0',
        trade_gross_value_nis: '0',
      }),
    ).toBeNull();
  });
});

describe('lowerOfTwo', () => {
  it('takes the smaller of two gains', () => {
    expect(lowerOfTwo(50, 80)).toBe(50);
    expect(lowerOfTwo(80, 50)).toBe(50);
  });

  it('takes the smaller of two losses', () => {
    expect(lowerOfTwo(-50, -80)).toBe(-50);
  });

  it('is nothing when one is a gain and the other a loss', () => {
    expect(lowerOfTwo(28.8, -51.2)).toBe(0);
    expect(lowerOfTwo(-10, 40)).toBe(0);
  });
});

describe('compareWithBankProfitLoss', () => {
  // the single-lot sale above
  const pnl = { pricePnL: 28.8, ratePnL: -80, localPnL: -51.2, proceedsLocal: 1468.8 };
  const bank = {
    nominal_profit_loss_nis: '-51.2',
    nominal_profit_loss_linkage: '80',
    real_profit_loss_nis: '0',
  };

  it('agrees with a bank that reports the linkage on the cost side and the lower of two', () => {
    expect(
      compareWithBankProfitLoss({ execution: bank, pnl, commissionsLocal: 0, isForeign: true }),
    ).toEqual([]);
  });

  it('allows for rounding', () => {
    expect(
      compareWithBankProfitLoss({
        execution: { ...bank, nominal_profit_loss_nis: '-52.5' },
        pnl,
        commissionsLocal: 0,
        isForeign: true,
      }),
    ).toEqual([]);
  });

  it('reports each figure that disagrees, in our sign convention', () => {
    expect(
      compareWithBankProfitLoss({
        execution: {
          nominal_profit_loss_nis: '-60',
          nominal_profit_loss_linkage: '-80',
          real_profit_loss_nis: '28.8',
        },
        pnl,
        commissionsLocal: 0,
        isForeign: true,
      }),
    ).toEqual([
      { field: 'NOMINAL', ours: -51.2, bank: -60 },
      { field: 'RATE', ours: -80, bank: 80 },
      { field: 'REAL', ours: 0, bank: 28.8 },
    ]);
  });

  it("accepts a nominal PnL with the trade's commissions deducted", () => {
    expect(
      compareWithBankProfitLoss({
        execution: { ...bank, nominal_profit_loss_nis: '-61.2' },
        pnl,
        commissionsLocal: 10,
        isForeign: true,
      }),
    ).toEqual([]);
  });

  it('only checks the nominal PnL of a security in the local currency', () => {
    expect(
      compareWithBankProfitLoss({
        execution: {
          nominal_profit_loss_nis: '100',
          nominal_profit_loss_linkage: '12',
          real_profit_loss_nis: '88',
        },
        pnl: { pricePnL: 100, ratePnL: 0, localPnL: 100, proceedsLocal: 1100 },
        commissionsLocal: 0,
        isForeign: false,
      }),
    ).toEqual([]);
  });

  it('checks nothing when the bank reports no PnL', () => {
    expect(
      compareWithBankProfitLoss({
        execution: {
          nominal_profit_loss_nis: '0',
          nominal_profit_loss_linkage: null,
          real_profit_loss_nis: '0',
        },
        pnl,
        commissionsLocal: 0,
        isForeign: true,
      }),
    ).toEqual([]);
  });
});

describe('costBasisProblem', () => {
  const sale = {
    security: '1234567',
    symbol: 'ABC',
    isin: 'US0000000001',
    trade_type: 'מכירה',
    trade_date: '2025-03-01',
    nominal_profit_loss_nis: '0',
  } as unknown as SecurityExecutionRow;
  const complete = {
    redeemedUnits: 10,
    costForeign: 1000,
    coveredUnits: 10,
    unknownCostUnits: 0,
    missingUnits: 0,
    historyStartDate: '2024-01-10' as const,
    openingPositionUnknown: false,
    lots: [],
  };

  it('is null when every unit has a known cost', () => {
    expect(costBasisProblem(sale, complete)).toBeNull();
  });

  it('says a sale is missing purchases', () => {
    expect(
      costBasisProblem(sale, { ...complete, coveredUnits: 6, missingUnits: 4, costForeign: 600 }),
    ).toContain('Could not find the purchase of 4 of 10 units of ABC (US0000000001) sold on 2025-03-01');
  });

  it('says a redemption is missing purchases', () => {
    expect(
      costBasisProblem(
        { ...sale, trade_type: 'פדיון' },
        { ...complete, coveredUnits: 6, missingUnits: 4, costForeign: 600 },
      ),
    ).toContain('redeemed on 2025-03-01');
  });
});
