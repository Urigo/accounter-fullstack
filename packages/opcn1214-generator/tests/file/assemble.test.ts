import { decodeWindows1255 } from '../../src/codec/windows1255.js';
import { renderReport } from '../../src/file/assemble.js';
import { buildControlRecord } from '../../src/file/control.js';
import { getLayout } from '../../src/layout/registry.js';
import type { RecordType } from '../../src/layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../../src/model/normalized.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { minimalInput } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';
const CAPITAL_GAINS_TYPES: readonly RecordType[] = [
  '3027',
  '3050',
  '3051',
  '3054',
  '3060',
  '3063',
  '3064',
  '3065',
  '3066',
  '3077',
];

function slice(line: string | undefined, position: number, length: number): string {
  if (line === undefined) {
    throw new Error('missing line');
  }
  return line.slice(position - 1, position - 1 + length);
}

function bareRecord(recordType: RecordType, index: number): NormalizedRecord {
  return { recordType, index, values: {}, codes: new Map(), countries: [], paths: {} };
}

/** A report holding `count` bare records of each given type, in the given order. */
function reportOf(counts: ReadonlyArray<readonly [RecordType, number]>): NormalizedReport {
  const records = counts.flatMap(([type, count]) =>
    Array.from({ length: count }, (_, index) => bareRecord(type, index)),
  );
  return { taxYear: 2024, layout: LAYOUT, records, notices: [], omittedZeroCodes: [] };
}

function minimalReport(): NormalizedReport {
  return normalizeReport(minimalInput(), LAYOUT, OPTIONS);
}

describe('buildControlRecord', () => {
  it('counts the records of the minimal report', () => {
    const control = buildControlRecord(minimalReport());
    expect(control).toEqual({
      recordType: '9999',
      index: 0,
      values: {
        reportCount: 1,
        relatedCompanyCount: 0,
        shareholderCount: 1,
        foreignAppendixCount: 0,
        capitalGainsAppendixCount: 0,
        foreignCountryRecordCount: 0,
        rdInvestmentRecordCount: 0,
      },
      codes: new Map(),
      countries: [],
      paths: {},
    });
  });

  it('has a value for every field of the 9999 layout', () => {
    const keys = LAYOUT.records['9999'].fields.map(field => field.key);
    expect(Object.keys(buildControlRecord(minimalReport()).values)).toEqual(keys);
  });

  it('throws for a 9999 field it has no count for', () => {
    const control = LAYOUT.records['9999'];
    const fields = control.fields.map(field =>
      field.key === 'rdInvestmentRecordCount' ? { ...field, key: 'newCount' } : field,
    );
    const layout = { ...LAYOUT, records: { ...LAYOUT.records, '9999': { ...control, fields } } };
    expect(() => buildControlRecord({ ...minimalReport(), layout })).toThrow(
      'No derivation for record 9999 field newCount',
    );
  });

  it('counts every record type it reports', () => {
    const report = reportOf([
      ['1000', 1],
      ['1010', 3],
      ['1020', 7],
      ['1030', 5],
      ['2000', 1],
      ['2200', 4],
      ...CAPITAL_GAINS_TYPES.map(type => [type, 1] as const),
      ['3077', 2],
    ]);
    expect(buildControlRecord(report).values).toEqual({
      reportCount: 1,
      relatedCompanyCount: 3,
      shareholderCount: 7,
      foreignAppendixCount: 1,
      capitalGainsAppendixCount: 12,
      foreignCountryRecordCount: 4,
      rdInvestmentRecordCount: 5,
    });
  });

  it.each(CAPITAL_GAINS_TYPES)('counts %s as a capital-gains appendix', type => {
    const report = reportOf([
      ['1000', 1],
      [type, 2],
    ]);
    expect(buildControlRecord(report).values['capitalGainsAppendixCount']).toBe(2);
  });

  it('reports the foreign appendix as 1 or 0', () => {
    expect(
      buildControlRecord(
        reportOf([
          ['1000', 1],
          ['2000', 1],
        ]),
      ).values['foreignAppendixCount'],
    ).toBe(1);
    expect(buildControlRecord(reportOf([['1000', 1]])).values['foreignAppendixCount']).toBe(0);
  });
});

describe('renderReport', () => {
  it('renders the minimal report as three CRLF-terminated lines', () => {
    const { lines, text, bytes } = renderReport(minimalReport());
    expect(lines.map(line => line.length)).toEqual([4232, 1160, 150]);
    expect(lines.map(line => line.slice(0, 8))).toEqual(['12141000', '12141020', '12149999']);
    expect(text).toBe(lines.join(CRLF) + CRLF);
    expect(text.endsWith(CRLF)).toBe(true);
    expect(text.split(CRLF)).toEqual([...lines, '']);
    expect(bytes.length).toBe(text.length);
    expect(decodeWindows1255(bytes)).toBe(text);
  });

  it('writes the asserted slices of 1000, 1020 and 9999', () => {
    const [main, shareholder, control] = renderReport(minimalReport()).lines;
    expect(slice(main, 137, 9)).toBe('514000009');
    expect(slice(main, 146, 4)).toBe('2024');
    expect(slice(main, 165, 10)).toBe('31/03/2025');
    expect(slice(main, 832, 1)).toBe('2');
    expect(slice(main, 2185, 3)).toBe('018');
    expect(slice(shareholder, 137, 2)).toBe('01');
    expect(slice(control, 137, 14)).toBe('01000100000000');
    expect(slice(control, 141, 2)).toBe('01');
  });

  it('encodes Hebrew text as single windows-1255 bytes', () => {
    const { lines, bytes } = renderReport(minimalReport());
    const name = 'ישראל ישראלי';
    expect(lines[1]).toContain(name);
    expect(bytes).toContain(0xe9); // 'י' in windows-1255
    expect(bytes.length).toBe(4232 + 1160 + 150 + 3 * CRLF.length);
  });

  it('emits records in report.records order and appends 9999 last', () => {
    const report = normalizeReport(
      minimalInput({
        shareholders: [
          {
            idNumber: '123456782',
            fullName: 'ראשון',
            isControllingShareholder: true,
            dividendRightsPercent: 50,
          },
          {
            idNumber: '000000018',
            fullName: 'שני',
            isControllingShareholder: false,
            dividendRightsPercent: 50,
          },
        ],
      }),
      LAYOUT,
      OPTIONS,
    );
    const [main, first, second] = report.records;
    if (!main || !first || !second) {
      throw new Error('expected three records');
    }
    const { lines } = renderReport({ ...report, records: [second, main, first] });
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1020', '1000', '1020', '9999']);
    expect(slice(lines[0], 137, 2)).toBe('02');
    expect(slice(lines[2], 137, 2)).toBe('01');
    expect(slice(lines[3], 141, 2)).toBe('02');
  });

  it('is deterministic', () => {
    const first = renderReport(normalizeReport(minimalInput(), LAYOUT, OPTIONS));
    const second = renderReport(normalizeReport(minimalInput(), LAYOUT, OPTIONS));
    expect(second.bytes).toEqual(first.bytes);
    expect(second.text).toBe(first.text);
  });
});
