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
});
