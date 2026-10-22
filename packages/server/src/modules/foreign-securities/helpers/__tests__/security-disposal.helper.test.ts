import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { SecurityExecutionRow } from '../../types.js';
import {
  calculateCpiCapitalGain,
  calculateDisposalPnL,
  carryingRateDate,
  compareWithBankProfitLoss,
  costBasisProblem,
  getDisposalProceeds,
  getExecutionBankRate,
  isDisposalExecution,
  lowerOfTwo,
} from '../security-disposal.helper.js';

/*
 * The arithmetic of a disposal out of FIFO lots. All values are made up.
 */

const USD_LABEL = 'דולר ארה"ב';

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

describe('calculateCpiCapitalGain', () => {
  it('exempts the CPI rise of the original price from a gain above it', () => {
    const result = calculateCpiCapitalGain([
      { originalLocal: 1000, considerationLocal: 1100, indexRatio: 1.03 },
    ]);

    expect(result.gain).toBeCloseTo(100, 6);
    expect(result.inflationaryAmount).toBeCloseTo(30, 6);
    expect(result.realGain).toBeCloseTo(70, 6);
    expect(result.lots[0]!.adjustedLocal).toBeCloseTo(1030, 6);
  });

  it('caps the inflationary amount at the gain, leaving no real gain or loss', () => {
    const result = calculateCpiCapitalGain([
      { originalLocal: 1000, considerationLocal: 1020, indexRatio: 1.03 },
    ]);

    expect(result.inflationaryAmount).toBeCloseTo(20, 6);
    expect(result.realGain).toBeCloseTo(0, 6);
  });

  it('does not index a loss', () => {
    const result = calculateCpiCapitalGain([
      { originalLocal: 1520, considerationLocal: 1468.8, indexRatio: 1.02 },
    ]);

    expect(result.gain).toBeCloseTo(-51.2, 6);
    expect(result.inflationaryAmount).toBe(0);
    expect(result.realGain).toBeCloseTo(-51.2, 6);
  });

  it('has no inflationary amount when the CPI fell', () => {
    const result = calculateCpiCapitalGain([
      { originalLocal: 1000, considerationLocal: 1100, indexRatio: 0.99 },
    ]);

    expect(result.inflationaryAmount).toBe(0);
    expect(result.realGain).toBeCloseTo(100, 6);
  });

  it('works each lot out on its own and adds them up', () => {
    const result = calculateCpiCapitalGain([
      { originalLocal: 1000, considerationLocal: 1100, indexRatio: 1.03 },
      { originalLocal: 500, considerationLocal: 450, indexRatio: 1.01 },
    ]);

    expect(result.gain).toBeCloseTo(50, 6);
    expect(result.inflationaryAmount).toBeCloseTo(30, 6);
    expect(result.realGain).toBeCloseTo(20, 6);
  });
});

describe('carryingRateDate', () => {
  it('is the last 31 December before the disposal for a lot held over it', () => {
    expect(carryingRateDate('2024-05-01', '2025-03-01')).toBe('2024-12-31');
    expect(carryingRateDate('2024-12-31', '2025-03-01')).toBe('2024-12-31');
    expect(carryingRateDate('2022-05-01', '2025-03-01')).toBe('2024-12-31');
  });

  it("is the lot's own booking date for a lot booked since", () => {
    expect(carryingRateDate('2025-01-10', '2025-03-01')).toBe('2025-01-10');
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

describe('getDisposalProceeds', () => {
  const execution = {
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    trade_gross_value_trade_currency: '1020',
    net_value_trade_currency: '1000',
    net_value_settlement_currency: '1000',
    net_value_nis: '0',
  };

  it('is the gross value, before tax', () => {
    expect(getDisposalProceeds(execution, Currency.Usd)).toBe(1020);
  });

  it('falls back to the cash brought in', () => {
    expect(
      getDisposalProceeds({ ...execution, trade_gross_value_trade_currency: '0' }, Currency.Usd),
    ).toBe(1000);
  });

  it('is null in a currency the execution does not report', () => {
    expect(getDisposalProceeds(execution, Currency.Eur)).toBeNull();
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

describe('isDisposalExecution', () => {
  it('is a sale or a redemption', () => {
    expect(isDisposalExecution({ trade_type: 'מכירה' })).toBe(true);
    expect(isDisposalExecution({ trade_type: 'פדיון' })).toBe(true);
    expect(isDisposalExecution({ trade_type: 'קניה' })).toBe(false);
    expect(isDisposalExecution({ trade_type: 'דבידנד תשלום' })).toBe(false);
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
