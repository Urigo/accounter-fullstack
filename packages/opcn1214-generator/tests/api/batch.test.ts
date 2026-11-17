import {
  generate1214,
  generate1214Batch,
  Opcn1214ParseError,
  Opcn1214ValidationError,
  parse1214,
  parse1214Batch,
  type Issue,
} from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import { minimalInput, relatedCompanies, withCheckDigit } from '../fixtures/builders.js';
import { dropLine } from '../fixtures/files.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

/** minimalInput() with the file number `withCheckDigit(51_400_000 + n)`. */
function report(n: number, overrides: Parameters<typeof minimalInput>[0] = {}) {
  return minimalInput({
    ...overrides,
    company: { ...overrides.company, fileNumber: withCheckDigit(51_400_000 + n) },
  });
}

/** The issues of the error `run` throws, which must be an instance of `type`. */
function thrownIssues(
  run: () => unknown,
  type: typeof Opcn1214ParseError | typeof Opcn1214ValidationError,
): readonly Issue[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(type);
    return (error as Opcn1214ParseError).issues;
  }
  throw new Error(`Expected an ${type.name}`);
}

describe('generate1214Batch', () => {
  const inputs = [report(1), report(2, { relatedCompanies: relatedCompanies(2) }), report(3)];

  it('concatenates the reports in input order, each with its own 9999', () => {
    const { text, bytes } = generate1214Batch(inputs, OPTIONS);
    const singles = inputs.map(input => generate1214(input, OPTIONS));
    expect(text).toBe(singles.map(single => single.text).join(''));
    expect(Buffer.from(bytes).equals(Buffer.concat(singles.map(single => single.bytes)))).toBe(
      true,
    );
    const lines = text.split(CRLF);
    expect(lines.filter(line => line.slice(4, 8) === '9999')).toHaveLength(3);
    expect(lines[0]?.slice(136, 145)).toBe(inputs[0]?.company.fileNumber);
    expect(lines[3]?.slice(136, 145)).toBe(inputs[1]?.company.fileNumber);
  });

  it("suggests the file name '1214_batch_<n>.txt'", () => {
    expect(generate1214Batch(inputs, OPTIONS).fileName).toBe('1214_batch_3.txt');
    expect(generate1214Batch([report(1)], OPTIONS).fileName).toBe('1214_batch_1.txt');
  });

  it('summarizes the batch: n reports, records summed, the largest main code-pair count', () => {
    const { summary } = generate1214Batch(inputs, OPTIONS);
    expect(summary.reports).toBe(3);
    expect(summary.records).toEqual({ '1000': 3, '1010': 2, '1020': 3, '9999': 3 });
    expect(summary.mainCodePairs).toBe(generate1214(report(1), OPTIONS).summary.mainCodePairs);
  });

  it('lists omitted zero codes with their report index', () => {
    const withZero = (n: number) => report(n, { amounts: { '010': 0 } });
    const { summary } = generate1214Batch([withZero(1), withZero(2)], OPTIONS);
    const single = generate1214(withZero(1), OPTIONS).summary.omittedZeroCodes;
    expect(single.length).toBeGreaterThan(0);
    expect(summary.omittedZeroCodes).toEqual([
      ...single.map(entry => ({ ...entry, reportIndex: 0 })),
      ...single.map(entry => ({ ...entry, reportIndex: 1 })),
    ]);
  });

  it('returns the warnings of every report with their report index', () => {
    const warned = report(2, { attachments: { donationReceiptsCount: 2 } });
    const { warnings } = generate1214Batch([report(1), warned], OPTIONS);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every(warning => warning.reportIndex === 1)).toBe(true);
  });

  it('validates every report independently; issues carry their report index', () => {
    const invalid = report(2, { company: { registeredName: '' } });
    const issues = thrownIssues(
      () => generate1214Batch([report(1), invalid, report(3), invalid], OPTIONS),
      Opcn1214ValidationError,
    );
    expect(
      issues.filter(issue => issue.ruleId === 'field.required').map(issue => issue.reportIndex),
    ).toEqual([1, 3]);
    expect(issues.every(issue => issue.reportIndex === 1 || issue.reportIndex === 3)).toBe(true);
  });

  it.each([0, 51])('throws struct.batch.size for %i reports', count => {
    const issues = thrownIssues(
      () =>
        generate1214Batch(
          Array.from({ length: count }, (_, index) => report(index)),
          OPTIONS,
        ),
      Opcn1214ValidationError,
    );
    expect(issues).toEqual([
      expect.objectContaining({ ruleId: 'struct.batch.size', severity: 'error', value: count }),
    ]);
  });

  it('accepts 50 reports', () => {
    const inputs50 = Array.from({ length: 50 }, (_, index) => report(index));
    expect(generate1214Batch(inputs50, OPTIONS).summary.reports).toBe(50);
  });
});

describe('parse1214Batch', () => {
  const inputs = [report(1), report(2, { relatedCompanies: relatedCompanies(1) }), report(3)];
  const { text, bytes } = generate1214Batch(inputs, OPTIONS);

  it('splits at each 9999 and returns one ParseResult per report', () => {
    const results = parse1214Batch(bytes);
    expect(results.map(result => result.report)).toEqual(
      inputs.map(input => canonicalize(input, OPTIONS)),
    );
    expect(results.map(result => result.saveDate)).toEqual([
      '2025-03-31',
      '2025-03-31',
      '2025-03-31',
    ]);
  });

  it('parses a single-report file as a batch of one', () => {
    const single = generate1214(report(1), OPTIONS).bytes;
    expect(parse1214Batch(single)).toEqual([parse1214(single)]);
  });

  it('marks the business issues of each report with its report index', () => {
    const latin = text.split(CRLF);
    // Line 6 is the 1020 record of the second report (1000, 1010, 1020, 9999).
    latin[5] = `${latin[5]?.slice(0, 147)}${'Israel Israeli'.padStart(50, ' ')}${latin[5]?.slice(197)}`;
    const results = parse1214Batch(latin.join(CRLF));
    expect(results[0]?.issues).toEqual([]);
    expect(results[1]?.issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'shareholders[0].fullName',
        reportIndex: 1,
      }),
    ]);
  });

  it('reports structural problems at their file line, with their report index', () => {
    const lines = text.split(CRLF);
    lines[5] = `${lines[5]?.slice(0, 8)}9${lines[5]?.slice(9)}`;
    const issues = thrownIssues(() => parse1214Batch(lines.join(CRLF)), Opcn1214ParseError);
    expect(issues).toEqual([
      expect.objectContaining({ ruleId: 'parse.prefixFiller', line: 6, column: 9, reportIndex: 1 }),
    ]);
  });

  it('reports a missing 9999 between reports as a second 1000 before a 9999', () => {
    // Line 3 is the 9999 record of the first report.
    const issues = thrownIssues(() => parse1214Batch(dropLine(text, 3)), Opcn1214ParseError);
    expect(issues[0]).toMatchObject({
      ruleId: 'parse.order',
      line: 3,
      column: 5,
      recordType: '1000',
      reportIndex: 0,
    });
    // The first two reports read as one; the third is still a report of its own.
    expect(issues.every(issue => issue.reportIndex === 0)).toBe(true);
  });

  it('reports a missing final 9999 after the last line', () => {
    const lines = text.split(CRLF);
    const withoutLast = dropLine(text, lines.length - 1);
    const issues = thrownIssues(() => parse1214Batch(withoutLast), Opcn1214ParseError);
    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: 'parse.control.missing',
        line: lines.length - 1,
        column: 1,
        reportIndex: 2,
      }),
    ]);
  });

  it('throws parse.empty for an empty file', () => {
    expect(thrownIssues(() => parse1214Batch(''), Opcn1214ParseError)).toEqual([
      expect.objectContaining({ ruleId: 'parse.empty', line: 1, column: 1 }),
    ]);
  });

  it('reports a 51st report as parse.occurrences at its first line', () => {
    const one = generate1214(report(1), OPTIONS).text;
    const issues = thrownIssues(() => parse1214Batch(one.repeat(51)), Opcn1214ParseError);
    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: 'parse.occurrences',
        line: 151,
        column: 1,
        reportIndex: 50,
      }),
    ]);
    expect(parse1214Batch(one.repeat(50))).toHaveLength(50);
  });
});

describe('parse1214 given a batch', () => {
  it('throws parse.multipleReports at the first record of the second report', () => {
    const { text } = generate1214Batch([report(1), report(2)], OPTIONS);
    expect(thrownIssues(() => parse1214(text), Opcn1214ParseError)).toEqual([
      expect.objectContaining({ ruleId: 'parse.multipleReports', line: 4, column: 1, path: '' }),
    ]);
  });

  it('still reports a record other than 1000 after the 9999 as parse.order', () => {
    const { text } = generate1214(report(1), OPTIONS);
    const lines = text.split(CRLF);
    const trailing = [...lines.slice(0, 3), lines[1], ''].join(CRLF);
    expect(thrownIssues(() => parse1214(trailing), Opcn1214ParseError)).toContainEqual(
      expect.objectContaining({ ruleId: 'parse.order', line: 4 }),
    );
  });
});
