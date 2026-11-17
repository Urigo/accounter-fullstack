import { generate1214 } from '../../src/api/generate.js';
import { parse1214 } from '../../src/api/parse.js';
import { COUNTRY_BREAKDOWN_CODES, type CountryCode } from '../../src/model/codes.generated.js';
import type { ForeignAppendix } from '../../src/model/input.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import type { RuleId } from '../../src/validate/rules.js';
import {
  breakdownCountries,
  foreignAppendix,
  foreignAppendixWithBreakdown,
  minimalInput,
} from '../fixtures/builders.js';
import { tamper } from '../fixtures/files.js';

const OPTIONS = { today: () => '2024-06-30' };

function issuesOf(appendix: ForeignAppendix, ruleId: RuleId): Issue[] {
  return runPipeline(minimalInput({ foreignAppendix: appendix }), OPTIONS).issues.filter(
    issue => issue.ruleId === ruleId,
  );
}

/** Issues of `ruleId` in the file of `appendix` with record 2000 (line 3) changed at `position`. */
function fileIssuesOf(
  appendix: ForeignAppendix,
  position: number,
  value: string,
  ruleId: RuleId,
): Issue[] {
  const { text } = generate1214(minimalInput({ foreignAppendix: appendix }), OPTIONS);
  return parse1214(tamper(text, { line: 3, position, value })).issues.filter(
    issue => issue.ruleId === ruleId,
  );
}

describe('foreign appendix rules (SPEC §10.5)', () => {
  it('foreign.otherIncome.description: other taxable income without its description, at 2000@137', () => {
    const appendix = { ...foreignAppendix(), otherTaxableIncomeDescription: undefined };
    expect(issuesOf(appendix, 'foreign.otherIncome.description')).toEqual([
      expect.objectContaining({
        severity: 'error',
        path: 'foreignAppendix.otherTaxableIncomeDescription',
        recordType: '2000',
        recordIndex: 0,
        field: expect.objectContaining({ position: 137, length: 50 }),
        specRef: { page: 26 },
      }),
    ]);
  });

  it('foreign.otherIncome.description: not raised without other taxable income, or for 0', () => {
    const appendix = { ...foreignAppendix(), otherTaxableIncomeDescription: undefined };
    expect(
      issuesOf({ ...appendix, otherTaxableIncome: undefined }, 'foreign.otherIncome.description'),
    ).toEqual([]);
    expect(
      issuesOf({ ...appendix, otherTaxableIncome: 0 }, 'foreign.otherIncome.description'),
    ).toEqual([]);
  });

  it('foreign.refund.amount: a refund declaration without its amount, at 2000@248 (warning)', () => {
    const appendix = { ...foreignAppendix(), taxRefundDeclarationAmount: undefined };
    expect(issuesOf(appendix, 'foreign.refund.amount')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        path: 'foreignAppendix.taxRefundDeclarationAmount',
        recordType: '2000',
        recordIndex: 0,
        field: expect.objectContaining({ position: 248, length: 12 }),
        specRef: { page: 26 },
      }),
    ]);
    // An amount of 0 is written as absent, so it counts as missing.
    expect(
      issuesOf({ ...foreignAppendix(), taxRefundDeclarationAmount: 0 }, 'foreign.refund.amount'),
    ).toHaveLength(1);
  });

  it('foreign.refund.amount: not raised for a "no" declaration', () => {
    const appendix = {
      ...foreignAppendix(),
      taxRefundDeclaration: false,
      taxRefundDeclarationAmount: undefined,
    };
    expect(issuesOf(appendix, 'foreign.refund.amount')).toEqual([]);
  });

  describe('country breakdowns (records 2200)', () => {
    it('foreign.breakdown.required: one issue per per-country code written without a breakdown', () => {
      const appendix = foreignAppendix({ amounts: { '420': 50_000, '442': 0, '401': 1 } });
      expect(issuesOf(appendix, 'foreign.breakdown.required')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'foreignAppendix.countryBreakdown["420"]',
          recordType: '2000',
          recordIndex: 0,
          code: '420',
          value: 50_000,
          specRef: { page: 27 },
        }),
        // 442 = 0 is written (zeroAllowed), so it needs a breakdown too (SPEC §15 A-24).
        expect.objectContaining({ path: 'foreignAppendix.countryBreakdown["442"]', code: '442' }),
      ]);
    });

    it('foreign.breakdown.required: not raised for a zero code that is omitted', () => {
      expect(
        issuesOf(foreignAppendix({ amounts: { '420': 0 } }), 'foreign.breakdown.required'),
      ).toEqual([]);
    });

    it('foreign.breakdown.orphan: a breakdown of a code that is absent or omitted as 0', () => {
      const appendix = foreignAppendixWithBreakdown('420', undefined, { amounts: { '420': 0 } });
      expect(issuesOf(appendix, 'foreign.breakdown.orphan')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'foreignAppendix.countryBreakdown["420"]',
          recordType: '2200',
          recordIndex: 0,
          code: '420',
          specRef: { page: 30 },
        }),
      ]);
    });

    it('foreign.breakdown.countries.min and .max: at the countries of the breakdown', () => {
      const empty = foreignAppendixWithBreakdown('439', { countries: [] });
      expect(issuesOf(empty, 'foreign.breakdown.countries.min')).toEqual([
        expect.objectContaining({
          path: 'foreignAppendix.countryBreakdown["439"].countries',
          recordType: '2200',
          code: '439',
        }),
      ]);
      const eleven = foreignAppendixWithBreakdown('439', { countries: breakdownCountries(11) });
      expect(issuesOf(eleven, 'foreign.breakdown.countries.max')).toEqual([
        expect.objectContaining({
          path: 'foreignAppendix.countryBreakdown["439"].countries',
          value: 11,
          specRef: { page: 30 },
        }),
      ]);
    });

    it('foreign.breakdown.country.unknown: every code outside the table, digits padded first', () => {
      const appendix = foreignAppendixWithBreakdown('420', {
        countries: [
          { country: '40' as CountryCode, income: 1 },
          { country: '001' as CountryCode, income: 1 },
          { country: 'XX' as CountryCode, income: 1 },
          { country: '999', income: 1 },
        ],
      });
      expect(issuesOf(appendix, 'foreign.breakdown.country.unknown')).toEqual([
        expect.objectContaining({
          path: 'foreignAppendix.countryBreakdown["420"].countries[1].country',
          value: '001',
        }),
        expect.objectContaining({
          path: 'foreignAppendix.countryBreakdown["420"].countries[2].country',
          value: 'XX',
        }),
      ]);
    });

    it('foreign.breakdown.country.unknownOnlyFor439: -88 outside code 439 only', () => {
      const countries = [{ country: '-88' as const, income: 1 }];
      expect(
        issuesOf(
          foreignAppendixWithBreakdown('442', { countries }),
          'foreign.breakdown.country.unknownOnlyFor439',
        ),
      ).toEqual([
        expect.objectContaining({
          path: 'foreignAppendix.countryBreakdown["442"].countries[0].country',
          value: '-88',
        }),
      ]);
      const on439 = runPipeline(
        minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('439', { countries }) }),
        OPTIONS,
      ).issues;
      expect(on439).toEqual([]);
    });

    it('foreign.breakdown.country.duplicate: each repetition, as a warning', () => {
      const appendix = foreignAppendixWithBreakdown('420', {
        countries: [
          { country: '840', income: 1 },
          { country: '040', income: 1 },
          { country: '840', income: 2 },
          { country: '40' as CountryCode, income: 3 },
        ],
      });
      expect(issuesOf(appendix, 'foreign.breakdown.country.duplicate')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'foreignAppendix.countryBreakdown["420"].countries[2].country',
          value: '840',
        }),
        expect.objectContaining({
          path: 'foreignAppendix.countryBreakdown["420"].countries[3].country',
          value: '040',
        }),
      ]);
    });

    it('a valid breakdown of every per-country code raises nothing', () => {
      const appendix = foreignAppendix({
        amounts: Object.fromEntries(COUNTRY_BREAKDOWN_CODES.map(code => [code, 100])),
        countryBreakdown: Object.fromEntries(
          COUNTRY_BREAKDOWN_CODES.map(code => [code, { countries: breakdownCountries(1) }]),
        ),
      });
      expect(runPipeline(minimalInput({ foreignAppendix: appendix }), OPTIONS).issues).toEqual([]);
    });

    it('breakdown rules are reported on parsed files too, at the breakdown paths', () => {
      const { text } = generate1214(
        minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') }),
        OPTIONS,
      );
      // Line 4 is the 2200 record; 2200@188 is the country of its first entry.
      const unknown = parse1214(tamper(text, { line: 4, position: 188, value: '001' })).issues;
      expect(unknown).toEqual([
        expect.objectContaining({
          ruleId: 'foreign.breakdown.country.unknown',
          path: 'foreignAppendix.countryBreakdown["420"].countries[0].country',
          recordType: '2200',
          recordIndex: 0,
        }),
      ]);
      // 2000@1161: code 401 (the first entry) turned into 420's neighbour 416, which has no breakdown.
      const required = parse1214(tamper(text, { line: 3, position: 1161, value: '416' })).issues;
      expect(required).toEqual([
        expect.objectContaining({
          ruleId: 'foreign.breakdown.required',
          path: 'foreignAppendix.countryBreakdown["416"]',
        }),
      ]);
    });
  });

  it('both rules are reported on parsed files too', () => {
    // 2000@137: the description blanked.
    expect(
      fileIssuesOf(foreignAppendix(), 137, ' '.repeat(50), 'foreign.otherIncome.description'),
    ).toEqual([expect.objectContaining({ path: 'foreignAppendix.otherTaxableIncomeDescription' })]);
    // 2000@248: the refund amount zeroed.
    expect(fileIssuesOf(foreignAppendix(), 248, '0'.repeat(12), 'foreign.refund.amount')).toEqual([
      expect.objectContaining({ path: 'foreignAppendix.taxRefundDeclarationAmount' }),
    ]);
  });
});
