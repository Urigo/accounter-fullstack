import { describe, expect, it } from 'vitest';
import {
  computeSemiAnnualDeclaration,
  getSemiAnnualPeriod,
  ledgerEntityAmount,
  ledgerRecordRate,
  splitIncomeWithholding,
  summarizeSemiAnnualSales,
  type SemiAnnualDeclarationParams,
  type SemiAnnualIncomeFigures,
  type SemiAnnualLedgerRecord,
  type SemiAnnualSaleFigures,
  type YearHalf,
} from '../securities-semi-annual-report.helper.js';

/*
 * The arithmetic of a company's semi-annual securities report. All values are made up.
 */

const RATE = 0.23;

const sale = (realGain: number | null, overrides: Partial<SemiAnnualSaleFigures> = {}) =>
  ({
    consideration: 10_000,
    realGain,
    inflationaryAmount: 0,
    israeliTaxWithheld: 0,
    ...overrides,
  }) satisfies SemiAnnualSaleFigures;

const income = (
  kind: SemiAnnualIncomeFigures['kind'],
  locality: SemiAnnualIncomeFigures['locality'],
  gross: number,
  overrides: Partial<SemiAnnualIncomeFigures> = {},
) =>
  ({
    kind,
    locality,
    gross,
    foreignTaxWithheld: 0,
    israeliTaxWithheld: 0,
    ...overrides,
  }) satisfies SemiAnnualIncomeFigures;

const declare = ({
  half = 'H1',
  firstHalfSales = [],
  firstHalfIncome = [],
  ...params
}: Partial<Omit<SemiAnnualDeclarationParams, 'half'>> & {
  half?: YearHalf;
  firstHalfSales?: readonly SemiAnnualSaleFigures[];
  firstHalfIncome?: readonly SemiAnnualIncomeFigures[];
}) => {
  const base = {
    taxRate: RATE,
    priorYearsLosses: 0,
    sales: [],
    income: [],
    expenses: 0,
    ...params,
  };
  return computeSemiAnnualDeclaration(
    half === 'H2'
      ? { ...base, half, firstHalf: { sales: firstHalfSales, income: firstHalfIncome } }
      : { ...base, half },
  );
};

const bucket = (
  declaration: ReturnType<typeof declare>,
  kind: SemiAnnualIncomeFigures['kind'],
  locality: SemiAnnualIncomeFigures['locality'],
) => declaration.incomeSummary.find(b => b.kind === kind && b.locality === locality)!;

describe('getSemiAnnualPeriod', () => {
  it('covers January to June, due on 31 July', () => {
    expect(getSemiAnnualPeriod(2026, 'H1')).toEqual({
      year: 2026,
      half: 'H1',
      fromDate: '2026-01-01',
      toDate: '2026-06-30',
      dueDate: '2026-07-31',
    });
  });

  it('covers July to December, due on 31 January of the next year', () => {
    expect(getSemiAnnualPeriod(2026, 'H2')).toEqual({
      year: 2026,
      half: 'H2',
      fromDate: '2026-07-01',
      toDate: '2026-12-31',
      dueDate: '2027-01-31',
    });
  });
});

describe('summarizeSemiAnnualSales', () => {
  it('counts every sale in the turnover, buys never being among them', () => {
    // bought, sold, re-bought and re-sold: only the two sales reach the report
    const summary = summarizeSemiAnnualSales([
      sale(1000, { consideration: 12_000 }),
      sale(500, { consideration: 8000 }),
    ]);

    expect(summary.salesTurnover).toBe(20_000);
    expect(summary.saleCount).toBe(2);
  });

  it('splits gains from losses, and nets them', () => {
    const summary = summarizeSemiAnnualSales([sale(3000), sale(-1200), sale(500), sale(-300)]);

    expect(summary.totalRealGains).toBe(3500);
    expect(summary.totalLosses).toBe(1500);
    expect(summary.netRealCapitalGain).toBe(2000);
  });

  it('counts a sale whose gain is unknown in the turnover only', () => {
    const summary = summarizeSemiAnnualSales([
      sale(1000, { consideration: 5000 }),
      sale(null, { consideration: 7000 }),
    ]);

    expect(summary.salesTurnover).toBe(12_000);
    expect(summary.totalRealGains).toBe(1000);
    expect(summary.totalLosses).toBe(0);
  });

  it('rounds each total to whole shekels before netting, so the lines add up', () => {
    const summary = summarizeSemiAnnualSales([sale(100.4), sale(100.4), sale(-50.6)]);

    expect(summary.totalRealGains).toBe(201);
    expect(summary.totalLosses).toBe(51);
    expect(summary.netRealCapitalGain).toBe(150);
  });
});

describe('computeSemiAnnualDeclaration', () => {
  it('taxes the net real gain at the corporate rate', () => {
    const declaration = declare({ sales: [sale(10_000), sale(-2000)] });

    expect(declaration.netRealCapitalGainAfterLosses).toBe(8000);
    expect(declaration.capitalGainsTax).toBe(1840);
    expect(declaration.taxLiability).toBe(1840);
    expect(declaration.taxAdvance).toBe(1840);
    expect(declaration.advanceNotes).toEqual([]);
  });

  it('owes nothing on a net loss, and says so', () => {
    const declaration = declare({ sales: [sale(1000), sale(-4000)] });

    expect(declaration.netRealCapitalGain).toBe(-3000);
    expect(declaration.capitalGainsTax).toBe(0);
    expect(declaration.taxAdvance).toBe(0);
    expect(declaration.advanceNotes).toEqual(['CAPITAL_LOSS_IN_PERIOD']);
  });

  it('offsets carried-forward losses that absorb the whole gain', () => {
    const declaration = declare({ sales: [sale(6000)], priorYearsLosses: 10_000 });

    expect(declaration.netRealCapitalGain).toBe(6000);
    expect(declaration.lossesCarriedForward).toBe(10_000);
    expect(declaration.netRealCapitalGainAfterLosses).toBe(-4000);
    expect(declaration.taxLiability).toBe(0);
    expect(declaration.taxAdvance).toBe(0);
    expect(declaration.advanceNotes).toEqual(['CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES']);
  });

  it('offsets carried-forward losses that absorb part of the gain', () => {
    const declaration = declare({ sales: [sale(10_000)], priorYearsLosses: 4000 });

    expect(declaration.netRealCapitalGainAfterLosses).toBe(6000);
    expect(declaration.capitalGainsTax).toBe(1380);
    expect(declaration.advanceNotes).toEqual(['CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES']);
  });

  describe('second half', () => {
    it("carries the prior years' losses the first half left unused", () => {
      const declaration = declare({
        half: 'H2',
        priorYearsLosses: 10_000,
        firstHalfSales: [sale(6000)],
        sales: [sale(9000)],
      });

      expect(declaration.firstHalfNetRealCapitalGain).toBe(6000);
      expect(declaration.lossesCarriedForward).toBe(4000);
      expect(declaration.netRealCapitalGainAfterLosses).toBe(5000);
      expect(declaration.capitalGainsTax).toBe(1150);
    });

    it("carries the first half's net loss, on top of the prior years' losses", () => {
      const declaration = declare({
        half: 'H2',
        priorYearsLosses: 1000,
        firstHalfSales: [sale(-3000)],
        sales: [sale(9000)],
      });

      expect(declaration.lossesCarriedForward).toBe(4000);
      expect(declaration.netRealCapitalGainAfterLosses).toBe(5000);
    });

    it('carries nothing once the first half used every loss up', () => {
      const declaration = declare({
        half: 'H2',
        priorYearsLosses: 2000,
        firstHalfSales: [sale(5000)],
        sales: [sale(9000)],
      });

      expect(declaration.lossesCarriedForward).toBe(0);
      expect(declaration.capitalGainsTax).toBe(2070);
      expect(declaration.advanceNotes).toEqual([]);
    });

    it('has no first half in the first half', () => {
      const declaration = declare({ priorYearsLosses: 2000, sales: [sale(1000)] });

      expect(declaration.firstHalfNetRealCapitalGain).toBeNull();
      expect(declaration.lossesCarriedForward).toBe(2000);
    });
  });

  describe('capital loss against dividends and interest (s.92(a)(4))', () => {
    it('offsets the whole income, leaving no liability', () => {
      const declaration = declare({
        sales: [sale(-4000)],
        income: [income('INTEREST', 'LOCAL', 3000)],
      });

      expect(declaration.capitalLossOffsetAgainstIncome).toBe(3000);
      expect(bucket(declaration, 'INTEREST', 'LOCAL').capitalLossOffset).toBe(3000);
      expect(declaration.interestTax).toBe(0);
      expect(declaration.taxLiability).toBe(0);
      expect(declaration.taxAdvance).toBe(0);
      expect(declaration.advanceNotes).toEqual([
        'CAPITAL_LOSS_IN_PERIOD',
        'CAPITAL_LOSS_OFFSET_AGAINST_INCOME',
      ]);
    });

    it('offsets part of the income, taxing the rest', () => {
      const declaration = declare({
        sales: [sale(-1000)],
        income: [income('INTEREST', 'LOCAL', 3000)],
      });

      expect(declaration.capitalLossOffsetAgainstIncome).toBe(1000);
      expect(declaration.interestTax).toBe(460);
      expect(declaration.taxAdvance).toBe(460);
    });

    it('offsets the income with the least foreign tax first, keeping the foreign tax credit', () => {
      const declaration = declare({
        sales: [sale(-1000)],
        income: [
          income('DIVIDEND', 'FOREIGN', 1000, { foreignTaxWithheld: 250 }),
          income('INTEREST', 'LOCAL', 1000),
        ],
      });

      expect(bucket(declaration, 'INTEREST', 'LOCAL').capitalLossOffset).toBe(1000);
      expect(bucket(declaration, 'DIVIDEND', 'FOREIGN').capitalLossOffset).toBe(0);
      expect(declaration.foreignTaxCredit).toBe(230);
      expect(declaration.taxLiability).toBe(0);
    });

    it('does not offset exempt local dividends', () => {
      const declaration = declare({
        sales: [sale(-1000)],
        income: [income('DIVIDEND', 'LOCAL', 5000)],
      });

      expect(declaration.capitalLossOffsetAgainstIncome).toBe(0);
    });

    it("never offsets the income with prior years' losses", () => {
      const declaration = declare({
        priorYearsLosses: 5000,
        income: [income('INTEREST', 'LOCAL', 1000)],
      });

      expect(declaration.capitalLossOffsetAgainstIncome).toBe(0);
      expect(declaration.interestTax).toBe(230);
    });

    it("carries to the second half only what the first half's income left of its loss", () => {
      const declaration = declare({
        half: 'H2',
        firstHalfSales: [sale(-3000)],
        firstHalfIncome: [income('INTEREST', 'LOCAL', 1000)],
        sales: [sale(5000)],
      });

      expect(declaration.lossesCarriedForward).toBe(2000);
      expect(declaration.capitalGainsTax).toBe(690);
    });

    it("offsets the second half's income with what is left of the first half's loss", () => {
      const declaration = declare({
        half: 'H2',
        firstHalfSales: [sale(-3000)],
        income: [income('INTEREST', 'LOCAL', 1000)],
      });

      expect(declaration.capitalLossOffsetAgainstIncome).toBe(1000);
      expect(declaration.taxLiability).toBe(0);
      expect(declaration.advanceNotes).toEqual(['CAPITAL_LOSS_OFFSET_AGAINST_INCOME']);
    });
  });

  describe('securities expenses', () => {
    it('come off the capital gain', () => {
      const declaration = declare({ sales: [sale(10_000)], expenses: 2000 });

      expect(declaration.securitiesExpenses).toBe(2000);
      expect(declaration.expensesDeductedFromGains).toBe(2000);
      expect(declaration.taxableCapitalGain).toBe(8000);
      expect(declaration.capitalGainsTax).toBe(1840);
    });

    it('come off the income once the gain is used up', () => {
      const declaration = declare({
        sales: [sale(1000)],
        income: [income('INTEREST', 'LOCAL', 1000)],
        expenses: 1500,
      });

      expect(declaration.capitalGainsTax).toBe(0);
      expect(declaration.expensesDeductedFromIncome).toBe(500);
      expect(declaration.interestTax).toBe(115);
    });

    it('leave what exceeds the taxable income for the annual return', () => {
      const declaration = declare({
        income: [income('INTEREST', 'LOCAL', 1000), income('DIVIDEND', 'LOCAL', 9000)],
        expenses: 5000,
      });

      expect(declaration.unusedExpenses).toBe(4000);
      expect(declaration.taxLiability).toBe(0);
    });

    it('do not spend carried-forward losses, which come off the gain first', () => {
      const declaration = declare({
        sales: [sale(10_000)],
        priorYearsLosses: 4000,
        expenses: 2000,
      });

      expect(declaration.taxableCapitalGain).toBe(4000);
      expect(declaration.capitalGainsTax).toBe(920);
    });

    it('count as an event of the half', () => {
      expect(declare({ expenses: 100 }).advanceNotes).toEqual([]);
    });
  });

  describe('dividends and interest', () => {
    it('does not tax local dividends, but taxes foreign dividends and all interest', () => {
      const declaration = declare({
        income: [
          income('DIVIDEND', 'LOCAL', 1000),
          income('DIVIDEND', 'FOREIGN', 2000),
          income('INTEREST', 'LOCAL', 3000),
          income('INTEREST', 'FOREIGN', 4000),
        ],
      });

      expect(declaration.dividendIncome).toBe(3000);
      expect(declaration.interestIncome).toBe(7000);
      expect(bucket(declaration, 'DIVIDEND', 'LOCAL')).toMatchObject({ taxable: false, tax: 0 });
      expect(bucket(declaration, 'DIVIDEND', 'FOREIGN')).toMatchObject({ taxable: true, tax: 460 });
      expect(declaration.dividendsTax).toBe(460);
      expect(declaration.interestTax).toBe(1610);
      expect(declaration.grossTax).toBe(2070);
      expect(declaration.taxAdvance).toBe(2070);
    });

    it('credits foreign tax up to the tax on the same bucket', () => {
      // 25% withheld abroad on a dividend taxed at 23% here: only 23% is credited
      const declaration = declare({
        income: [income('DIVIDEND', 'FOREIGN', 1000, { foreignTaxWithheld: 250 })],
      });

      expect(bucket(declaration, 'DIVIDEND', 'FOREIGN').foreignTaxCredit).toBe(230);
      expect(declaration.foreignTaxCredit).toBe(230);
      expect(declaration.taxLiability).toBe(0);
      expect(declaration.taxAdvance).toBe(0);
      expect(declaration.advanceNotes).toEqual(['INCOME_TAX_COVERED_BY_FOREIGN_TAX']);
    });

    it('does not let excess foreign tax on dividends reduce the tax on interest', () => {
      const declaration = declare({
        income: [
          income('DIVIDEND', 'FOREIGN', 1000, { foreignTaxWithheld: 300 }),
          income('INTEREST', 'FOREIGN', 1000, { foreignTaxWithheld: 100 }),
        ],
      });

      expect(declaration.foreignTaxCredit).toBe(330);
      expect(declaration.taxLiability).toBe(460 - 330);
      expect(declaration.advanceNotes).toEqual([]);
    });

    it('does not credit foreign tax on local dividends, which carry no tax', () => {
      const declaration = declare({
        income: [income('DIVIDEND', 'LOCAL', 1000, { foreignTaxWithheld: 100 })],
      });

      expect(bucket(declaration, 'DIVIDEND', 'LOCAL').foreignTaxCredit).toBe(0);
      expect(declaration.taxLiability).toBe(0);
    });

    it('nets a reversed dividend out of its bucket', () => {
      const declaration = declare({
        income: [
          income('DIVIDEND', 'FOREIGN', 1000, { foreignTaxWithheld: 250 }),
          income('DIVIDEND', 'FOREIGN', -1000, { foreignTaxWithheld: -250 }),
        ],
      });

      expect(declaration.dividendIncome).toBe(0);
      expect(declaration.foreignTaxCredit).toBe(0);
    });
  });

  describe('Israeli tax withheld at source', () => {
    it('is credited against the liability', () => {
      const declaration = declare({
        sales: [sale(10_000, { israeliTaxWithheld: 1000 })],
        income: [income('INTEREST', 'LOCAL', 1000, { israeliTaxWithheld: 230 })],
      });

      expect(declaration.israeliTaxWithheld).toBe(1000);
      expect(declaration.israeliTaxWithheldOnIncome).toBe(230);
      expect(declaration.taxLiability).toBe(2300 + 230);
      expect(declaration.taxAdvance).toBe(2530 - 1230);
      expect(declaration.excessCredits).toBe(0);
    });

    it('is not credited on exempt local dividends', () => {
      const declaration = declare({
        sales: [sale(10_000)],
        income: [
          income('DIVIDEND', 'LOCAL', 1000, { israeliTaxWithheld: 250 }),
          income('INTEREST', 'LOCAL', 1000, { israeliTaxWithheld: 150 }),
        ],
      });

      expect(declaration.israeliTaxWithheldOnIncome).toBe(150);
      expect(declaration.israeliTaxWithheldOnExemptIncome).toBe(250);
      expect(declaration.taxLiability).toBe(2300 + 230);
      expect(declaration.taxAdvance).toBe(2530 - 150);
    });

    it('leaves no advance once it covers the liability, and reports the excess', () => {
      const declaration = declare({ sales: [sale(1000, { israeliTaxWithheld: 400 })] });

      expect(declaration.taxLiability).toBe(230);
      expect(declaration.taxAdvance).toBe(0);
      expect(declaration.excessCredits).toBe(170);
      expect(declaration.advanceNotes).toEqual(['LIABILITY_COVERED_BY_WITHHOLDING']);
    });

    it('never credits a net refund', () => {
      const declaration = declare({ sales: [sale(1000, { israeliTaxWithheld: -100 })] });

      expect(declaration.taxAdvance).toBe(230);
      expect(declaration.excessCredits).toBe(0);
    });
  });

  it('says when the half had nothing to report', () => {
    const declaration = declare({});

    expect(declaration.salesTurnover).toBe(0);
    expect(declaration.taxAdvance).toBe(0);
    expect(declaration.advanceNotes).toEqual(['NO_TAXABLE_EVENTS']);
  });

  it('works out no tax without a tax rate, but still totals the income', () => {
    const declaration = declare({
      taxRate: null,
      sales: [sale(1000)],
      income: [income('DIVIDEND', 'FOREIGN', 500)],
    });

    expect(declaration.netRealCapitalGain).toBe(1000);
    expect(declaration.dividendIncome).toBe(500);
    expect(declaration.capitalGainsTax).toBeNull();
    expect(declaration.taxLiability).toBeNull();
    expect(declaration.taxAdvance).toBeNull();
    expect(bucket(declaration, 'DIVIDEND', 'FOREIGN').tax).toBeNull();
    expect(declaration.advanceNotes).toEqual([]);
  });

  it('rounds every line to whole shekels, so the sheet adds up', () => {
    const declaration = declare({
      sales: [sale(1234.56)],
      income: [income('INTEREST', 'FOREIGN', 333.33, { foreignTaxWithheld: 10.4 })],
    });

    expect(declaration.capitalGainsTax).toBe(Math.round(1235 * RATE));
    expect(declaration.interestTax).toBe(Math.round(333 * RATE));
    expect(declaration.grossTax).toBe(declaration.capitalGainsTax! + declaration.interestTax!);
    expect(declaration.taxLiability).toBe(declaration.grossTax! - declaration.foreignTaxCredit!);
  });
});

const record = (overrides: Partial<SemiAnnualLedgerRecord>): SemiAnnualLedgerRecord => ({
  debit_entity1: null,
  debit_entity2: null,
  credit_entity1: null,
  credit_entity2: null,
  debit_local_amount1: null,
  debit_local_amount2: null,
  credit_local_amount1: null,
  credit_local_amount2: null,
  debit_foreign_amount1: null,
  debit_foreign_amount2: null,
  credit_foreign_amount1: null,
  credit_foreign_amount2: null,
  ...overrides,
});

const INCOME = 'income-category';
const WITHHOLDING = 'withholding-category';
const BANK = 'bank';

describe('ledgerEntityAmount', () => {
  // a dividend: bank and withholding debited, income credited at the gross
  const dividend = record({
    debit_entity1: BANK,
    debit_local_amount1: '2775',
    debit_entity2: WITHHOLDING,
    debit_local_amount2: '925',
    credit_entity1: INCOME,
    credit_local_amount1: '3700',
  });

  it('reads income as credits less debits', () => {
    expect(ledgerEntityAmount(dividend, INCOME)).toBe(3700);
  });

  it('reads a withholding line as a debit, from the second slot too', () => {
    expect(-ledgerEntityAmount(dividend, WITHHOLDING)).toBe(925);
  });

  it('reads a reversal negated', () => {
    const reversal = record({
      debit_entity1: INCOME,
      debit_local_amount1: '3700',
      credit_entity1: BANK,
      credit_local_amount1: '2775',
      credit_entity2: WITHHOLDING,
      credit_local_amount2: '925',
    });

    expect(ledgerEntityAmount(reversal, INCOME)).toBe(-3700);
    expect(-ledgerEntityAmount(reversal, WITHHOLDING)).toBe(-925);
  });

  it('is zero for an entity the record does not touch', () => {
    expect(ledgerEntityAmount(dividend, 'other')).toBe(0);
  });
});

describe('ledgerRecordRate', () => {
  it("reads the rate off the entity's slot", () => {
    const foreign = record({
      credit_entity1: INCOME,
      credit_local_amount1: '3700',
      credit_foreign_amount1: '1000',
    });

    expect(ledgerRecordRate(foreign, INCOME)).toBeCloseTo(3.7, 9);
  });

  it('is 1 on a local-currency record', () => {
    expect(ledgerRecordRate(record({ credit_entity1: INCOME, credit_local_amount1: '50' }), INCOME)).toBe(1);
  });

  it('is null when the entity is not on the record', () => {
    expect(ledgerRecordRate(record({}), INCOME)).toBeNull();
  });
});

describe('splitIncomeWithholding', () => {
  it("apportions the line by the execution's foreign and Israeli tax", () => {
    const split = splitIncomeWithholding({
      locality: 'FOREIGN',
      withheld: 925,
      parts: { foreign: 150, israeli: 100 },
      rate: 3.7,
    });

    expect(split.matched).toBe(true);
    expect(split.foreign).toBeCloseTo(555, 9);
    expect(split.israeli).toBeCloseTo(370, 9);
    expect(split.mismatch).toBeCloseTo(0, 9);
  });

  it('keeps to the line, and reports how far the execution is from it', () => {
    const split = splitIncomeWithholding({
      locality: 'FOREIGN',
      withheld: 900,
      parts: { foreign: 150, israeli: 100 },
      rate: 4,
    });

    expect(split.foreign).toBeCloseTo(540, 9);
    expect(split.israeli).toBeCloseTo(360, 9);
    expect(split.mismatch).toBeCloseTo(100, 9);
  });

  it("keeps a reversal's sign", () => {
    const split = splitIncomeWithholding({
      locality: 'FOREIGN',
      withheld: -925,
      parts: { foreign: -150, israeli: -100 },
      rate: 3.7,
    });

    expect(split.foreign).toBeCloseTo(-555, 9);
    expect(split.israeli).toBeCloseTo(-370, 9);
    expect(split.mismatch).toBeCloseTo(0, 9);
  });

  it("apportions by the execution's split when the record's rate is unknown", () => {
    expect(
      splitIncomeWithholding({
        locality: 'LOCAL',
        withheld: 100,
        parts: { foreign: 30, israeli: 10 },
        rate: null,
      }),
    ).toEqual({ foreign: 75, israeli: 25, matched: true, mismatch: 0 });
  });

  it('flags a line the execution reports no tax for', () => {
    expect(
      splitIncomeWithholding({
        locality: 'FOREIGN',
        withheld: 100,
        parts: { foreign: 0, israeli: 0 },
        rate: 3.7,
      }),
    ).toEqual({ foreign: 100, israeli: 0, matched: true, mismatch: -100 });
  });

  it('takes an untraced line as Israeli tax on a local security', () => {
    expect(
      splitIncomeWithholding({ locality: 'LOCAL', withheld: 100, parts: null, rate: 1 }),
    ).toEqual({ foreign: 0, israeli: 100, matched: false, mismatch: 0 });
  });

  it('takes an untraced line as foreign tax on a foreign security', () => {
    expect(
      splitIncomeWithholding({ locality: 'FOREIGN', withheld: 100, parts: null, rate: null }),
    ).toEqual({ foreign: 100, israeli: 0, matched: false, mismatch: 0 });
  });
});
