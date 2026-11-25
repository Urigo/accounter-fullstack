import { generate1214 } from '../../src/api/generate.js';
import { parse1214 } from '../../src/api/parse.js';
import type { ForeignAppendix } from '../../src/model/input.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import type { RuleId } from '../../src/validate/rules.js';
import { foreignAppendix, minimalInput } from '../fixtures/builders.js';
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

  it('a filled per-country code is allowed without a breakdown until F2', () => {
    const appendix = foreignAppendix({ amounts: { '420': 50_000, '439': 1 } });
    expect(
      runPipeline(minimalInput({ foreignAppendix: appendix }), OPTIONS).issues.filter(
        issue => issue.severity === 'error',
      ),
    ).toEqual([]);
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
