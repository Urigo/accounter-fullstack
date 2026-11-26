import { GraphQLError } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnnualTaxData } from '../../../reports/helpers/annual-tax-data.helper.js';
import type { Report1214ProfileProto } from '../../types.js';
import {
  CODE_SOURCES,
  codeSourcesNeedTaxData,
  computeMainFormAmounts,
  REPORT_1214_AMOUNT_RULES,
  type Report1214AmountsData,
  type Report1214CodeSources,
} from '../report-1214-amounts.helper.js';
import { resolveReport1214TaxData } from '../report-1214-input.helper.js';

const YEAR = 2024;

/** An `AnnualTaxData`-shaped fixture: only the tax computation the code sources read. */
const TAX = {
  year: YEAR,
  ownerId: 'owner-1',
  taxAmounts: {
    taxableIncomeAmount: 100_000.4,
    taxRate: 0.23,
    specialTaxableIncome: { amount: 0 },
    specialTaxRate: 0.23,
    annualTaxExpenseAmount: 23_000.09,
    currentTaxExpense: 23_000.09,
    taxableLoss: 0,
    mixedRateLoss: false,
  },
} as unknown as AnnualTaxData;

function data(overrides: Partial<Report1214AmountsData> = {}): Report1214AmountsData {
  return { year: YEAR, tax: TAX, profile: { rdInvestments: [] }, ...overrides };
}

function rdInvestments(...amounts: number[]): Report1214ProfileProto['rdInvestments'] {
  return amounts.map((investmentAmount, index) => ({
    companyName: `חברה ${index + 1}`,
    investmentAmount,
  }));
}

/** A code source that reads the books (the verified table has none yet). */
function taxSource(
  compute: (data: { tax: AnnualTaxData }) => number | undefined = () => undefined,
) {
  return { label: 'test', specRef: 'p.0', requiresTaxData: true, compute } as const;
}

/** A code source that needs no books. */
function profileSource(compute: () => number | undefined) {
  return { label: 'test', specRef: 'p.0', requiresTaxData: false, compute } as const;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CODE_SOURCES', () => {
  it('maps only codes verified against the layout specification', () => {
    expect(Object.keys(CODE_SOURCES)).toEqual(['165']);
    for (const source of Object.values(CODE_SOURCES)) {
      expect(source!.label).not.toBe('');
      expect(source!.specRef).toMatch(/^p\.\d+$/);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CODE_SOURCES)).toBe(true);
  });

  it('needs no books for the verified codes', () => {
    expect(codeSourcesNeedTaxData(YEAR)).toBe(false);
    const sources: Report1214CodeSources = { '072': taxSource() };
    expect(codeSourcesNeedTaxData(YEAR, sources)).toBe(true);
    expect(codeSourcesNeedTaxData(1999, sources)).toBe(false);
    // a derived code is never computed, so it needs no books either
    expect(codeSourcesNeedTaxData(YEAR, { '008': taxSource() } as Report1214CodeSources)).toBe(
      false,
    );
  });
});

describe('computeMainFormAmounts', () => {
  it('computes code 165 as the total of the R&D investments, in whole shekels', () => {
    const { amounts, issues } = computeMainFormAmounts(
      data({ profile: { rdInvestments: rdInvestments(1000, 2500.4, 99.5) } }),
    );
    expect(amounts).toEqual({ '165': 1000 + 2500 + 100 });
    expect(issues).toEqual([]);
  });

  it('computes code 165 without the books', () => {
    expect(
      computeMainFormAmounts(data({ tax: null, profile: { rdInvestments: rdInvestments(5) } }))
        .amounts,
    ).toEqual({ '165': 5 });
  });

  it('maps nothing when no source has a value', () => {
    expect(computeMainFormAmounts(data())).toEqual({ amounts: {}, issues: [] });
    expect(computeMainFormAmounts(data({ tax: null }))).toEqual({ amounts: {}, issues: [] });
  });

  it('leaves out a 0 total of a code that does not allow 0 (165)', () => {
    expect(
      computeMainFormAmounts(data({ profile: { rdInvestments: rdInvestments(0, 0.2) } })).amounts,
    ).toEqual({});
  });

  it('rounds to whole shekels and keeps 0 only where the layout allows it', () => {
    const sources: Report1214CodeSources = {
      '072': taxSource(({ tax }) => tax.taxAmounts.taxableLoss), // zeroAllowed
      '010': profileSource(() => 0.3), // not zeroAllowed: rounds to 0
      '011': taxSource(({ tax }) => tax.taxAmounts.annualTaxExpenseAmount),
      '012': profileSource(() => -0.4), // -0 is 0
    };
    expect(computeMainFormAmounts(data(), sources).amounts).toEqual({ '072': 0, '011': 23_000 });
  });

  it('skips the codes that need the books when they were not loaded', () => {
    const compute = vi.fn(() => 1);
    expect(
      computeMainFormAmounts(data({ tax: null }), { '011': taxSource(compute) }).amounts,
    ).toEqual({});
    expect(compute).not.toHaveBeenCalled();
  });

  it('never computes a derived code or one the layout lacks', () => {
    const sources = {
      '008': taxSource(() => 1), // derived from appliesAccountingStandards
      '999': taxSource(() => 1),
    } as Report1214CodeSources;
    expect(computeMainFormAmounts(data(), sources).amounts).toEqual({});
  });

  it('computes nothing for a year without a layout', () => {
    expect(
      computeMainFormAmounts(data({ year: 1999, profile: { rdInvestments: rdInvestments(5) } })),
    ).toEqual({ amounts: {}, issues: [] });
  });

  it('reports a non-finite computed amount instead of writing it', () => {
    const { amounts, issues } = computeMainFormAmounts(data(), {
      '011': taxSource(() => Number.NaN),
    });
    expect(amounts).toEqual({});
    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: REPORT_1214_AMOUNT_RULES.computedInvalid,
        severity: 'warning',
        code: '011',
        path: 'amounts["011"]',
      }),
    ]);
  });
});

describe('resolveReport1214TaxData', () => {
  const params = (overrides: Partial<Parameters<typeof resolveReport1214TaxData>[0]> = {}) => ({
    year: YEAR,
    ownerId: 'owner-1',
    isActiveOwner: vi.fn(async () => true),
    load: vi.fn(async () => TAX),
    codeSources: { '011': taxSource() } as Report1214CodeSources,
    ...overrides,
  });

  it('loads nothing while no code needs the books', async () => {
    const p = params({ codeSources: undefined }); // CODE_SOURCES
    expect(await resolveReport1214TaxData(p)).toEqual({ tax: null, issues: [] });
    expect(p.isActiveOwner).not.toHaveBeenCalled();
    expect(p.load).not.toHaveBeenCalled();
  });

  describe('when a code needs the books', () => {
    it('loads the books of the active owner', async () => {
      const p = params();
      expect(await resolveReport1214TaxData(p)).toEqual({ tax: TAX, issues: [] });
      expect(p.load).toHaveBeenCalledOnce();
    });

    it('skips another owner, with a warning', async () => {
      const p = params({ isActiveOwner: vi.fn(async () => false) });
      const result = await resolveReport1214TaxData(p);
      expect(p.load).not.toHaveBeenCalled();
      expect(result.tax).toBeNull();
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: REPORT_1214_AMOUNT_RULES.computationSkipped,
          severity: 'warning',
          message: expect.stringContaining('not the active business'),
        }),
      ]);
    });

    it('skips a year without a layout before checking anything else', async () => {
      const p = params({ year: 1999 });
      expect(await resolveReport1214TaxData(p)).toEqual({ tax: null, issues: [] });
      expect(p.isActiveOwner).not.toHaveBeenCalled();
      expect(p.load).not.toHaveBeenCalled();
    });

    it('reports a failing tax computation and goes on without the books', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const p = params({
        load: vi.fn(async () => {
          throw new GraphQLError('No tax rate for year');
        }),
      });
      const result = await resolveReport1214TaxData(p);
      expect(result.tax).toBeNull();
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: REPORT_1214_AMOUNT_RULES.computationFailed,
          severity: 'warning',
          message: expect.stringContaining('No tax rate for year'),
        }),
      ]);
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('does not echo the message of an unexpected error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('connect ECONNREFUSED 10.0.0.5:5432 (secret detail)');
      const result = await resolveReport1214TaxData(
        params({
          load: vi.fn(async () => {
            throw error;
          }),
        }),
      );
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        ruleId: REPORT_1214_AMOUNT_RULES.computationFailed,
        message: expect.stringContaining('see server log'),
      });
      expect(result.issues[0].message).not.toContain('secret detail');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to compute 1214 amounts from the books:',
        error,
      );
    });
  });
});
