import { runPipeline } from '../src/pipeline.js';
import { minimalInput } from './fixtures/builders.js';

const OPTIONS = { today: () => '2024-06-30' };

describe('runPipeline', () => {
  it('returns the normalized report and no issues for a valid input', () => {
    const { report, issues } = runPipeline(minimalInput(), OPTIONS);
    expect(issues).toEqual([]);
    expect(report?.taxYear).toBe(2024);
    expect(report?.records.map(record => record.recordType)).toEqual(['1000', '1020']);
  });

  it('uses the layout of the tax year', () => {
    expect(runPipeline(minimalInput({ taxYear: 2025 }), OPTIONS).report?.layout.taxYear).toBe(2025);
  });

  describe('year stage (struct.taxYear.unsupported)', () => {
    it('stops on an unsupported year with exactly that issue, without throwing', () => {
      // A second defect proves that nothing runs after the year stage.
      const input = { ...minimalInput({ company: { registeredName: undefined } }), taxYear: 2023 };
      expect(runPipeline(input, OPTIONS)).toEqual({
        issues: [
          {
            ruleId: 'struct.taxYear.unsupported',
            severity: 'error',
            message: 'Tax year 2023 is not supported (supported: 2024, 2025).',
            path: 'taxYear',
            value: 2023,
            expected: 'one of 2024, 2025',
          },
        ],
      });
    });

    it.each([
      ['a missing tax year', { company: {} }],
      ['a string tax year', { taxYear: '2024' }],
      ['a non-object input', null],
      ['a non-object input', 'report'],
    ])('reports %s', (_, input) => {
      const { report, issues } = runPipeline(input, OPTIONS);
      expect(report).toBeUndefined();
      expect(issues).toEqual([
        expect.objectContaining({ ruleId: 'struct.taxYear.unsupported', path: 'taxYear' }),
      ]);
    });
  });

  describe('shape stage (input.shape)', () => {
    it('stops after the shape stage with only its issues', () => {
      // Two shape defects and a field defect: the field rules must not run.
      const base = minimalInput({ company: { registeredName: '' } });
      const input = { ...base, meta: null, company: { ...base.company, faxx: '1' } };
      expect(runPipeline(input, OPTIONS)).toEqual({
        issues: [
          expect.objectContaining({ ruleId: 'input.shape', severity: 'error', path: 'meta' }),
          expect.objectContaining({ ruleId: 'input.shape', path: 'company.faxx' }),
        ],
      });
    });

    it('runs after the year stage', () => {
      const input = { ...minimalInput(), taxYear: 2023, faxx: 1 };
      expect(runPipeline(input, OPTIONS).issues.map(issue => issue.ruleId)).toEqual([
        'struct.taxYear.unsupported',
      ]);
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['a string', 'x'],
      ['a number', 42],
      ['an empty object', {}],
      ['an object with only a tax year', { taxYear: 2024 }],
      ['wrongly typed members', { taxYear: 2024, company: [], amounts: 'x', shareholders: [null] }],
    ])('never throws for %s', (_, input) => {
      const result = runPipeline(input, OPTIONS);
      expect(result.report).toBeUndefined();
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});
