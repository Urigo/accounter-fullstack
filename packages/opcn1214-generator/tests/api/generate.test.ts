import { decodeRecord } from '../../src/codec/record.js';
import { decodeWindows1255 } from '../../src/codec/windows1255.js';
import {
  generate1214,
  Opcn1214Error,
  Opcn1214ValidationError,
  validate1214,
  type PhonePrefix,
} from '../../src/index.js';
import { getLayout } from '../../src/layout/registry.js';
import {
  foreignAppendix,
  minimalInput,
  rdInvestments,
  rdInvestmentsTotal,
  relatedCompanies,
} from '../fixtures/builders.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

/** The number of code-amount pairs in the record 1000 line of `text`, decoded from the file. */
function writtenMainCodePairs(text: string): number {
  const line = text.split(CRLF)[0] ?? '';
  return decodeRecord(getLayout(2024).records['1000'], line, 0).codes.size;
}

function slice(line: string | undefined, position: number, length: number): string {
  if (line === undefined) {
    throw new Error('missing line');
  }
  return line.slice(position - 1, position - 1 + length);
}

/** The error generate1214 throws for `input`; fails the test when it does not throw. */
function generationError(input: Parameters<typeof generate1214>[0]): Opcn1214ValidationError {
  try {
    generate1214(input, OPTIONS);
  } catch (error) {
    if (error instanceof Opcn1214ValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error('generate1214 did not throw');
}

describe('generate1214', () => {
  it('returns the file as text and windows-1255 bytes', () => {
    const result = generate1214(minimalInput(), OPTIONS);
    const lines = result.text.split(CRLF);
    expect(lines.pop()).toBe('');
    expect(lines.map(line => line.length)).toEqual([4232, 1160, 150]);
    expect(lines.map(line => line.slice(0, 8))).toEqual(['12141000', '12141020', '12149999']);
    expect(result.text.endsWith(CRLF)).toBe(true);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBe(result.text.length);
    expect(decodeWindows1255(result.bytes)).toBe(result.text);
    expect(slice(lines[0], 137, 9)).toBe('514000009');
    expect(slice(lines[0], 146, 4)).toBe('2024');
  });

  it('suggests a file name from the file number and tax year', () => {
    expect(generate1214(minimalInput(), OPTIONS).fileName).toBe('1214_514000009_2024.txt');
    const provisional = generate1214(minimalInput({ taxYear: 2025 }), OPTIONS);
    expect(provisional.fileName).toBe('1214_514000009_2025.txt');
    // A 2025 report is generated on the 2024 layout with one warning (SPEC §14).
    expect(provisional.warnings.map(issue => issue.ruleId)).toEqual([
      'struct.taxYear.provisionalLayout',
    ]);
  });

  it('uses the file number as written in the file (9 digits)', () => {
    const result = generate1214(minimalInput({ company: { fileNumber: '12' } }), OPTIONS);
    expect(slice(result.text, 137, 9)).toBe('000000012');
    expect(result.fileName).toBe('1214_000000012_2024.txt');
  });

  it('summarizes the report', () => {
    const { summary, text } = generate1214(minimalInput(), OPTIONS);
    // Five input codes and the derived code 273 (SPEC §7.4).
    expect(summary).toEqual({
      reports: 1,
      records: { '1000': 1, '1020': 1, '9999': 1 },
      mainCodePairs: 6,
      omittedZeroCodes: [],
    });
    expect(writtenMainCodePairs(text)).toBe(6);
  });

  it('counts records per type and the code pairs written in record 1000', () => {
    const shareholder = minimalInput().shareholders[0];
    if (!shareholder) {
      throw new Error('missing shareholder');
    }
    const input = minimalInput({
      amounts: { '010': 500 },
      shareholders: [
        { ...shareholder, dividendRightsPercent: 60 },
        { ...shareholder, idNumber: '000000018', fullName: 'שרה כהן', dividendRightsPercent: 40 },
      ],
    });
    const { summary, text } = generate1214(input, OPTIONS);
    expect(summary.records).toEqual({ '1000': 1, '1020': 2, '9999': 1 });
    expect(summary.mainCodePairs).toBe(7);
    expect(writtenMainCodePairs(text)).toBe(7);
    expect(text.split(CRLF).filter(line => line.slice(4, 8) === '1020')).toHaveLength(2);
  });

  it('writes related companies as 1010 records between 1000 and 1020, counted at 9999@139', () => {
    const input = minimalInput({
      relatedCompanies: [
        { companyName: 'חברת האם', companyFileNumber: '12', relationType: 'parent' },
        ...relatedCompanies(3).slice(1),
      ],
    });
    const { summary, text } = generate1214(input, OPTIONS);
    const lines = text.split(CRLF);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1010',
      '1010',
      '1010',
      '1020',
      '9999',
      '',
    ]);
    expect(summary.records).toEqual({ '1000': 1, '1010': 3, '1020': 1, '9999': 1 });
    expect(lines.slice(1, 4).map(line => line.length)).toEqual([1160, 1160, 1160]);
    // 1010@137 serial, @139 name, @189 file number, @198 relation type, @199 assessing office.
    expect(lines.slice(1, 4).map(line => slice(line, 137, 2))).toEqual(['01', '02', '03']);
    expect(slice(lines[1], 139, 50)).toBe('חברת האם'.padStart(50, ' '));
    expect(slice(lines[1], 189, 9)).toBe('000000012');
    expect(slice(lines[1], 198, 1)).toBe('1');
    expect(slice(lines[1], 199, 2)).toBe('00');
    expect(slice(lines[2], 198, 3)).toBe('211');
    expect(slice(lines[3], 198, 3)).toBe('312');
    expect(slice(lines[5], 139, 2)).toBe('03');
  });

  it('writes 00 at 9999@139 without related companies', () => {
    const lines = generate1214(minimalInput({ relatedCompanies: [] }), OPTIONS).text.split(CRLF);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', '9999', '']);
    expect(slice(lines[2], 139, 2)).toBe('00');
  });

  it('writes R&D investments as 1030 records after 1020, counted at 9999@149', () => {
    const input = minimalInput({
      relatedCompanies: relatedCompanies(1),
      rdInvestments: [
        { companyName: 'חברת מו"פ', companyFileNumber: '12', investmentAmount: 250_000 },
        ...rdInvestments(5).slice(1),
      ],
      amounts: { '165': 250_000 + rdInvestmentsTotal(5) - 100_000 },
    });
    const { summary, text } = generate1214(input, OPTIONS);
    const lines = text.split(CRLF);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1010',
      '1020',
      '1030',
      '1030',
      '1030',
      '1030',
      '1030',
      '9999',
      '',
    ]);
    expect(summary.records).toEqual({ '1000': 1, '1010': 1, '1020': 1, '1030': 5, '9999': 1 });
    const rd = lines.slice(3, 8);
    expect(rd.map(line => line.length)).toEqual([336, 336, 336, 336, 336]);
    // 1030@137 affiliation, @138 name, @188 file number, @197 amount, @209 filler.
    expect(rd.map(line => slice(line, 137, 1))).toEqual(['1', '1', '1', '1', '1']);
    expect(slice(rd[0], 138, 50)).toBe('חברת מו"פ'.padStart(50, ' '));
    expect(slice(rd[0], 188, 9)).toBe('000000012');
    expect(slice(rd[0], 197, 12)).toBe('000000250000');
    expect(slice(rd[0], 209, 128)).toBe('0'.repeat(128));
    expect(slice(rd[4], 188, 21)).toBe('520000005000000500000');
    expect(slice(lines[8], 149, 2)).toBe('05');
  });

  it('writes 00 at 9999@149 without R&D investments', () => {
    const lines = generate1214(minimalInput({ rdInvestments: [] }), OPTIONS).text.split(CRLF);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', '9999', '']);
    expect(slice(lines[2], 149, 2)).toBe('00');
  });

  it('writes the foreign appendix as a 2000 record after 1030, with 832 = 1 and 9999@143 = 01', () => {
    const input = minimalInput({
      rdInvestments: rdInvestments(1),
      amounts: { '165': rdInvestmentsTotal(1) },
      foreignAppendix: foreignAppendix({ amounts: { '420': 50_000, '442': 0 } }),
    });
    const { summary, text } = generate1214(input, OPTIONS);
    const lines = text.split(CRLF);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1020',
      '1030',
      '2000',
      '9999',
      '',
    ]);
    expect(summary.records).toEqual({ '1000': 1, '1020': 1, '1030': 1, '2000': 1, '9999': 1 });
    const [main, , , foreign, control] = lines;
    expect(foreign?.length).toBe(2184);
    expect(slice(main, 832, 1)).toBe('1');
    // 2000@137 description, @187–246 five amounts, @247 yes/no, @248 amount, @260 filler.
    expect(slice(foreign, 137, 50)).toBe('תמלוגים מחו"ל'.padStart(50, ' '));
    expect(slice(foreign, 187, 12)).toBe('000000040000');
    expect(slice(foreign, 199, 12)).toBe('000000006000');
    expect(slice(foreign, 211, 12)).toBe('000000120000');
    expect(slice(foreign, 223, 12)).toBe('000000015000');
    expect(slice(foreign, 235, 12)).toBe('000000007000');
    expect(slice(foreign, 247, 1)).toBe('1');
    expect(slice(foreign, 248, 12)).toBe('000000002500');
    expect(slice(foreign, 260, 901)).toBe('0'.repeat(901));
    // The section starts at 1161 (SPEC §15 A-9); every value has 12 digits (A-4); 442 = 0 is kept.
    const entries = [
      '401000000080000',
      '420000000050000',
      '425000000012345',
      '442000000000000',
      '494000000000001',
    ].join('');
    expect(slice(foreign, 1161, entries.length)).toBe(entries);
    expect(slice(foreign, 1161 + entries.length, 1024 - entries.length)).toBe(
      '0'.repeat(1024 - entries.length),
    );
    expect(slice(control, 143, 2)).toBe('01');
  });

  it('writes 832 = 2 and 00 at 9999@143 without a foreign appendix', () => {
    const lines = generate1214(minimalInput(), OPTIONS).text.split(CRLF);
    expect(slice(lines[0], 832, 1)).toBe('2');
    expect(slice(lines[2], 143, 2)).toBe('00');
  });

  it('writes 2 at 2000@247 for a "no" refund declaration and an empty section as zeros', () => {
    const input = minimalInput({ foreignAppendix: { taxRefundDeclaration: false, amounts: {} } });
    const foreign = generate1214(input, OPTIONS).text.split(CRLF)[2];
    expect(slice(foreign, 137, 50)).toBe(' '.repeat(50));
    expect(slice(foreign, 187, 60)).toBe('0'.repeat(60));
    expect(slice(foreign, 247, 13)).toBe('2000000000000');
    expect(slice(foreign, 1161, 1024)).toBe('0'.repeat(1024));
  });

  it('lists omitted zero codes of the foreign appendix', () => {
    const input = minimalInput({
      foreignAppendix: { taxRefundDeclaration: false, amounts: { '401': 0, '442': 0 } },
    });
    const { summary, text } = generate1214(input, OPTIONS);
    expect(summary.omittedZeroCodes).toEqual([{ record: '2000', recordIndex: 0, code: '401' }]);
    expect(slice(text.split(CRLF)[2], 1161, 15)).toBe('442000000000000');
  });

  it('lists omitted zero codes', () => {
    const { summary, text } = generate1214(minimalInput({ amounts: { '010': 0 } }), OPTIONS);
    expect(summary.omittedZeroCodes).toEqual([{ record: '1000', recordIndex: 0, code: '010' }]);
    expect(summary.mainCodePairs).toBe(6);
    expect(writtenMainCodePairs(text)).toBe(6);
  });

  it('honours options.today for the save date', () => {
    const first = generate1214(minimalInput(), { today: () => '2025-03-31' });
    const second = generate1214(minimalInput(), { today: () => '2025-04-01' });
    expect(slice(first.text, 165, 10)).toBe('31/03/2025');
    expect(slice(second.text, 165, 10)).toBe('01/04/2025');
  });

  it('prefers meta.saveDate over options.today', () => {
    const result = generate1214(minimalInput({ meta: { saveDate: '2025-01-15' } }), OPTIONS);
    expect(slice(result.text, 165, 10)).toBe('15/01/2025');
  });

  it('is deterministic', () => {
    expect(generate1214(minimalInput(), OPTIONS).bytes).toEqual(
      generate1214(minimalInput(), OPTIONS).bytes,
    );
  });

  it('returns the warnings of a valid report', () => {
    expect(generate1214(minimalInput(), OPTIONS).warnings).toEqual([]);
    // An invalid fax prefix is dropped with a warning (field.phonePrefix); the fax is optional,
    // so the report stays valid.
    const input = minimalInput({
      company: { fax: { prefix: '01' as PhonePrefix, number: '1234567' } },
    });
    const { warnings } = generate1214(input, OPTIONS);
    expect(warnings.map(issue => issue.ruleId)).toEqual(['field.phonePrefix']);
    expect(warnings).toEqual(validate1214(input, OPTIONS).warnings);
  });

  it('throws Opcn1214ValidationError carrying every error and warning', () => {
    const input = minimalInput({
      company: { registeredName: ' ', phone: { prefix: '01' as PhonePrefix } },
    });
    const { errors, warnings } = validate1214(input, OPTIONS);
    expect(errors.length).toBeGreaterThan(1);
    expect(warnings.length).toBeGreaterThan(0);

    const error = generationError(input);
    expect(error).toBeInstanceOf(Opcn1214Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('Opcn1214ValidationError');
    expect(error.issues).toEqual([...errors, ...warnings]);
    expect(error.message).toMatch(/^1214 report has 2 errors and 1 warning: field\.required at /);
  });

  it('throws for an unsupported tax year', () => {
    const error = generationError({ ...minimalInput(), taxYear: 2023 as 2024 });
    expect(error.issues.map(issue => issue.ruleId)).toEqual(['struct.taxYear.unsupported']);
    expect(error.message).toMatch(/^1214 report has 1 error: struct\.taxYear\.unsupported at /);
  });

  it('throws for an input of the wrong shape', () => {
    const error = generationError(null as never);
    expect(error.issues[0]?.ruleId).toBe('struct.taxYear.unsupported');
  });
});
