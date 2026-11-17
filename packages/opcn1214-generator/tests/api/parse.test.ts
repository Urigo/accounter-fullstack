import { encodeWindows1255 } from '../../src/codec/windows1255.js';
import { generate1214, Opcn1214ParseError, parse1214, type Issue } from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import {
  bettermentTaxAppendix,
  breakdownCountries,
  forcedVirtualCurrencyAppendix,
  foreignAppendix,
  foreignAppendixWithBreakdown,
  improvements,
  minimalInput,
  noWithholding1322Appendix,
  noWithholding1326Appendix,
  oilPartnershipAppendix,
  otherTransactionsAppendix,
  rdInvestments,
  rdInvestmentsTotal,
  reitAppendix,
  relatedCompanies,
  section6Appendices,
  section6Appendix,
  securitiesAppendix,
  sharesAppendix,
  withholders,
} from '../fixtures/builders.js';
import { dropLine, goldenText, tamper as tamperAt } from '../fixtures/files.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

function tamper(text: string, line: number, position: number, value: string): string {
  return tamperAt(text, { line, position, value });
}

/** The issues of the Opcn1214ParseError `run` throws; fails when it throws nothing or another error. */
function parseErrorIssues(run: () => unknown): readonly Issue[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Opcn1214ParseError);
    return (error as Opcn1214ParseError).issues;
  }
  throw new Error('Expected an Opcn1214ParseError');
}

describe('parse1214', () => {
  const { text, bytes } = generate1214(
    minimalInput({ meta: { softwareName: 'MY SOFT', saveDate: '2025-02-03' } }),
    OPTIONS,
  );

  it('returns the canonical report, the save date and the software name', () => {
    const result = parse1214(bytes);
    expect(result.saveDate).toBe('2025-02-03');
    expect(result.softwareName).toBe('MY SOFT');
    expect(result.report).toEqual(
      canonicalize(
        minimalInput({ meta: { softwareName: 'MY SOFT', saveDate: '2025-02-03' } }),
        OPTIONS,
      ),
    );
    expect(result.issues).toEqual([]);
  });

  it('accepts LF line endings', () => {
    expect(parse1214(text.replaceAll(CRLF, '\n')).report).toEqual(parse1214(bytes).report);
  });

  it('returns field issues of a well-formed but invalid file with input paths, without throwing', () => {
    const blankName = tamper(text, 1, 175, ' '.repeat(50));
    const result = parse1214(blankName);
    expect(result.report.company).not.toHaveProperty('registeredName');
    expect(result.issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.required',
        severity: 'error',
        path: 'company.registeredName',
        recordType: '1000',
      }),
    ]);
  });

  it('locates issues of shareholder records by their input index', () => {
    const latinName = tamper(text, 2, 148, 'Israel Israeli'.padStart(50, ' '));
    expect(parse1214(latinName).issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'shareholders[0].fullName',
        recordType: '1020',
        recordIndex: 0,
      }),
    ]);
  });

  it('reads the layout from the tax year of record 1000', () => {
    const { bytes: bytes2025 } = generate1214(minimalInput({ taxYear: 2025 }), OPTIONS);
    const result = parse1214(bytes2025);
    expect(result.report.taxYear).toBe(2025);
    // A 2025 file is read with the provisional 2024 layout (SPEC §14).
    expect(result.issues).toEqual([
      expect.objectContaining({
        ruleId: 'struct.taxYear.provisionalLayout',
        severity: 'warning',
        path: 'taxYear',
        value: 2025,
      }),
    ]);
  });

  it('returns an empty save date and software name when the file leaves them blank', () => {
    const result = parse1214(tamper(text, 1, 150, ' '.repeat(25)));
    expect(result.saveDate).toBe('');
    expect(result.softwareName).toBe('');
    expect(result.report).not.toHaveProperty('meta');
    expect(result.issues.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['field.required', 'meta.softwareName'],
      ['field.required', 'meta.saveDate'],
    ]);
  });

  it('returns the values of a file not written by generate1214 as read, not canonicalized', () => {
    // A double space in the registered name: generate1214 would have normalized it (SPEC §4.3).
    const result = parse1214(tamper(text, 1, 175, 'חברה  בעמ'.padStart(50, ' ')));
    expect(result.issues).toEqual([]);
    expect(result.report.company.registeredName).toBe('חברה  בעמ');
    expect(canonicalize(result.report, OPTIONS)).not.toEqual(result.report);
  });

  it('throws Opcn1214ParseError for an empty file and for a file that does not start with 1000', () => {
    expect(parseErrorIssues(() => parse1214(''))).toEqual([
      expect.objectContaining({ ruleId: 'parse.empty', line: 1, column: 1 }),
    ]);
    expect(parseErrorIssues(() => parse1214(dropLine(text, 1)))).toEqual([
      expect.objectContaining({ ruleId: 'parse.order', line: 1, column: 5 }),
    ]);
  });

  it('reports every structural problem of a file, sorted by line, each with line and column', () => {
    let broken = tamper(text, 3, 141, '07');
    broken = tamper(broken, 1, 165, '31/04/2025');
    broken = tamper(broken, 2, 9, '9');
    const issues = parseErrorIssues(() => parse1214(broken));
    expect(issues.map(({ ruleId, line, column }) => ({ ruleId, line, column }))).toEqual([
      { ruleId: 'parse.date', line: 1, column: 165 },
      { ruleId: 'parse.prefixFiller', line: 2, column: 9 },
      { ruleId: 'parse.control.counts', line: 3, column: 141 },
    ]);
    expect(issues[0]).toMatchObject({
      path: 'meta.saveDate',
      recordType: '1000',
      recordIndex: 0,
      field: { position: 165, length: 10 },
      severity: 'error',
    });
    expect(issues[2]).toMatchObject({ value: 7, expected: '1', recordType: '9999' });
  });

  it('continues with the next line after a problem', () => {
    const broken = tamper(tamper(text, 1, 137, 'X'), 2, 147, 'Y');
    expect(parseErrorIssues(() => parse1214(broken))).toEqual([
      expect.objectContaining({ ruleId: 'parse.numeric', line: 1, column: 137 }),
      expect.objectContaining({
        ruleId: 'parse.numeric',
        line: 2,
        column: 147,
        path: 'shareholders[0].idNumber',
      }),
    ]);
  });

  it('reports a line of the wrong length at the first missing or extra column', () => {
    const lines = text.split(CRLF);
    const short = [lines[0], lines[1], lines[2]?.slice(0, -1), ''].join(CRLF);
    const long = [lines[0], `${lines[1]}0`, lines[2], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(short))).toEqual([
      expect.objectContaining({ ruleId: 'parse.lineLength', line: 3, column: 150 }),
    ]);
    expect(parseErrorIssues(() => parse1214(long))).toEqual([
      expect.objectContaining({ ruleId: 'parse.lineLength', line: 2, column: 1161 }),
    ]);
  });

  it('reports a second 1000 record and records after 9999 as out of order', () => {
    const lines = text.split(CRLF);
    const twoMains = [lines[0], lines[0], lines[1], lines[2], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(twoMains))).toContainEqual(
      expect.objectContaining({ ruleId: 'parse.order', line: 2 }),
    );
  });

  it('reports a record after the 9999, and only that, without miscounting the 9999', () => {
    const lines = text.split(CRLF);
    const after = [lines[0], lines[1], lines[2], lines[1], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(after))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.order',
        line: 4,
        column: 5,
        message: 'Line 4, column 5: Record 1020 comes after the 9999 record that ends the report.',
      }),
    ]);
    // A 1000 record after the 9999 starts a second report (H1): parse1214Batch reads it.
    const mainAfter = [lines[0], lines[1], lines[2], lines[0], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(mainAfter))).toEqual([
      expect.objectContaining({ ruleId: 'parse.multipleReports', line: 4, column: 1 }),
    ]);
  });

  it('reports a second 9999 record', () => {
    const lines = text.split(CRLF);
    const twoControls = [lines[0], lines[1], lines[2], lines[2], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(twoControls))).toEqual([
      expect.objectContaining({ ruleId: 'parse.order', line: 4, recordType: '9999' }),
    ]);
  });

  it('reports a missing 9999 after the last line', () => {
    expect(parseErrorIssues(() => parse1214(dropLine(text, 3)))).toEqual([
      expect.objectContaining({ ruleId: 'parse.control.missing', line: 3, column: 1 }),
    ]);
  });

  it('reports an undecodable byte with parse.encoding at its line and column', () => {
    const bytes = new TextEncoder().encode(text);
    const secondLine = bytes.indexOf(0x0a) + 1;
    bytes[secondLine + 9] = 0xc3;
    expect(parseErrorIssues(() => parse1214(bytes, { encoding: 'utf-8' }))).toEqual([
      expect.objectContaining({ ruleId: 'parse.encoding', line: 2, column: 10 }),
    ]);
    const golden = new TextEncoder().encode('1214');
    const unassigned = new Uint8Array([...golden, 0xff]);
    expect(parseErrorIssues(() => parse1214(unassigned))).toContainEqual(
      expect.objectContaining({ ruleId: 'parse.encoding', line: 1, column: 5 }),
    );
  });

  it('still selects the layout when the bad byte of the 1000 line comes after the tax year', () => {
    // Byte 200 of line 1 is 0xFF (unassigned in windows-1255), and line 2 is one character short.
    const golden = goldenText('minimal');
    const lines = golden.split(CRLF);
    const bytes = encodeWindows1255(
      [lines[0], lines[1]?.slice(0, -1), ...lines.slice(2)].join(CRLF),
    );
    bytes[199] = 0xff;
    expect(parseErrorIssues(() => parse1214(bytes))).toEqual([
      expect.objectContaining({ ruleId: 'parse.encoding', line: 1, column: 200 }),
      expect.objectContaining({ ruleId: 'parse.lineLength', line: 2, column: 1160 }),
    ]);
    // Before the tax year, the layout is unknown: only the encoding problem is reported.
    const early = encodeWindows1255(goldenText('minimal'));
    early[140] = 0xff;
    expect(parseErrorIssues(() => parse1214(early))).toEqual([
      expect.objectContaining({ ruleId: 'parse.encoding', line: 1, column: 141 }),
    ]);
  });

  it('gives decode errors inside a code-amount entry the code and its input path', () => {
    // 1000@2185 is the code-amount section: code 018 (1 digit), then code 072 (value from 2192).
    expect(text.split(CRLF)[0]?.slice(2184, 2192)).toBe('01840720');
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 2195, 'X')))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.numeric',
        code: '072',
        path: 'amounts["072"]',
        line: 1,
        column: 2195,
      }),
    ]);
    // An unknown code has no input path.
    const [issue] = parseErrorIssues(() => parse1214(tamper(text, 1, 2185, '999')));
    expect(issue).toMatchObject({ ruleId: 'parse.codeSection', path: '' });
    expect(issue).not.toHaveProperty('code');
  });

  it('gives decode errors in a capital-gains code section the path of that appendix', () => {
    const cg = generate1214(minimalInput({ capitalGains: section6Appendices(2) }), OPTIONS).text;
    // The second 3063 record is capitalGains[1]; its code-amount section starts at 3063@1161.
    const line = cg.split(CRLF).findLastIndex(candidate => candidate.slice(4, 8) === '3063') + 1;
    expect(cg.split(CRLF)[line - 1]?.slice(1160, 1163)).toBe('022');
    expect(parseErrorIssues(() => parse1214(tamper(cg, line, 1165, 'X')))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.numeric',
        code: '022',
        path: 'capitalGains[1].amounts["022"]',
        line,
        column: 1165,
      }),
    ]);
  });

  it('reports an unsupported tax year in 1000@146 as struct.taxYear.unsupported', () => {
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 146, '2023')))).toEqual([
      expect.objectContaining({
        ruleId: 'struct.taxYear.unsupported',
        path: 'taxYear',
        value: 2023,
        line: 1,
        column: 146,
      }),
    ]);
  });

  it('reports a tax year that is not a number as parse.numeric', () => {
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 146, '20X4')))).toEqual([
      expect.objectContaining({ ruleId: 'parse.numeric', path: 'taxYear', line: 1, column: 146 }),
    ]);
  });

  it('maps format problems inside header fields to parse.fieldValue', () => {
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 493, '011')))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.fieldValue',
        path: 'company.phone.prefix',
        line: 1,
        column: 493,
      }),
    ]);
  });

  describe('related companies (1010)', () => {
    const related = generate1214(
      minimalInput({ relatedCompanies: relatedCompanies(2) }),
      OPTIONS,
    ).text;

    it('reads 1010 records between 1000 and 1020 back as relatedCompanies', () => {
      const result = parse1214(related);
      expect(result.report.relatedCompanies).toEqual(relatedCompanies(2));
      expect(result.issues).toEqual([]);
    });

    it.each([
      ['before 1000', [1, 0, 2, 3, 4], 1],
      ['after 1020', [0, 1, 3, 2, 4], 4],
    ])('reports a 1010 record %s as parse.order', (_, order, line) => {
      const lines = related.split(CRLF);
      const reordered = [...order.map(index => lines[index]), ''].join(CRLF);
      expect(parseErrorIssues(() => parse1214(reordered))).toContainEqual(
        expect.objectContaining({ ruleId: 'parse.order', recordType: '1010', line }),
      );
    });

    it('locates issues of 1010 records by their input index', () => {
      // 1010@198 relation type 9 is not an allowed value.
      const result = parse1214(tamper(related, 3, 198, '9'));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.enum',
          path: 'relatedCompanies[1].relationType',
          recordType: '1010',
          recordIndex: 1,
        }),
      ]);
      expect(result.report.relatedCompanies?.[1]?.relationType).toBe(9);
    });

    it('reports 1010 records the 9999 record does not count (9999@139)', () => {
      expect(parseErrorIssues(() => parse1214(tamper(related, 5, 139, '01')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 5, column: 139 }),
      ]);
    });
  });

  describe('R&D investments (1030)', () => {
    const rd = generate1214(
      minimalInput({ rdInvestments: rdInvestments(2), amounts: { '165': rdInvestmentsTotal(2) } }),
      OPTIONS,
    ).text;

    it('reads 1030 records after 1020 back as rdInvestments', () => {
      const result = parse1214(rd);
      expect(result.report.rdInvestments).toEqual(rdInvestments(2));
      expect(result.report.amounts['165']).toBe(rdInvestmentsTotal(2));
      expect(result.issues).toEqual([]);
    });

    it.each([
      ['a 1030 record before 1000', [2, 0, 1, 3, 4], '1030', 1],
      ['a 1020 record after a 1030 record', [0, 2, 1, 3, 4], '1020', 3],
    ])('reports %s as parse.order', (_, order, recordType, line) => {
      const lines = rd.split(CRLF);
      const reordered = [...order.map(index => lines[index]), ''].join(CRLF);
      expect(parseErrorIssues(() => parse1214(reordered))).toContainEqual(
        expect.objectContaining({ ruleId: 'parse.order', recordType, line }),
      );
    });

    it('locates issues of 1030 records by their input index', () => {
      // 1030@138: a blank company name.
      const result = parse1214(tamper(rd, 4, 138, ' '.repeat(50)));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.required',
          path: 'rdInvestments[1].companyName',
          recordType: '1030',
          recordIndex: 1,
        }),
      ]);
    });

    it('reports 1030 records the 9999 record does not count (9999@149)', () => {
      expect(parseErrorIssues(() => parse1214(tamper(rd, 5, 149, '01')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 5, column: 149 }),
      ]);
    });
  });

  describe('foreign appendix (2000)', () => {
    const appendix = foreignAppendix({
      amounts: { '420': 50_000, '442': 0 },
      countryBreakdown: {
        '420': { countries: breakdownCountries(1) },
        '442': { countries: breakdownCountries(1) },
      },
    });
    const foreign = generate1214(
      minimalInput({
        rdInvestments: rdInvestments(1),
        amounts: { '165': rdInvestmentsTotal(1) },
        foreignAppendix: appendix,
      }),
      OPTIONS,
    ).text;

    it('reads a 2000 record after 1030 back as foreignAppendix', () => {
      const result = parse1214(foreign);
      expect(result.report.foreignAppendix).toEqual(appendix);
      expect(result.issues).toEqual([]);
    });

    it('reads no foreignAppendix from a file without a 2000 record', () => {
      expect(parse1214(text).report).not.toHaveProperty('foreignAppendix');
    });

    it.each([
      ['a 2000 record before 1030', [0, 1, 3, 2, 4, 5, 6], '1030', 4],
      ['a 2000 record before 1020', [0, 3, 1, 2, 4, 5, 6], '1020', 3],
    ])('reports %s as parse.order', (_, order, recordType, line) => {
      const lines = foreign.split(CRLF);
      const reordered = [...order.map(index => lines[index]), ''].join(CRLF);
      expect(parseErrorIssues(() => parse1214(reordered))).toContainEqual(
        expect.objectContaining({ ruleId: 'parse.order', recordType, line }),
      );
    });

    it('locates issues of the 2000 record at foreignAppendix paths', () => {
      // 2000@247: the required refund declaration written as absent.
      const result = parse1214(tamper(foreign, 4, 247, '0'));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.required',
          path: 'foreignAppendix.taxRefundDeclaration',
          recordType: '2000',
          recordIndex: 0,
        }),
      ]);
    });

    it('reports a 2000 record the 9999 record does not count (9999@143)', () => {
      expect(parseErrorIssues(() => parse1214(tamper(foreign, 7, 143, '00')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 7, column: 143 }),
      ]);
    });

    it('reports a 9999@143 of 01 without a 2000 record', () => {
      expect(parseErrorIssues(() => parse1214(tamper(text, 3, 143, '01')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 3, column: 143 }),
      ]);
    });
  });

  describe('country breakdowns (2200)', () => {
    const appendix = foreignAppendix({
      amounts: { '420': 50_000, '439': 7000 },
      countryBreakdown: {
        '420': { deductionsOffsetsAndExemptions: 1234, countries: breakdownCountries(2) },
        '439': { countries: [{ country: '-88', income: 7000 }] },
      },
    });
    // Lines: 1000, 1020, 2000, 2200 (420), 2200 (439), 9999.
    const breakdowns = generate1214(minimalInput({ foreignAppendix: appendix }), OPTIONS).text;
    const SECTION = 187;

    it('reads the 2200 records after 2000 back as foreignAppendix.countryBreakdown', () => {
      const result = parse1214(breakdowns);
      expect(result.report.foreignAppendix).toEqual(appendix);
      expect(result.issues).toEqual([]);
    });

    it.each([
      // The 2000 record after it is out of order too.
      ['a 2200 record before 2000', [0, 1, 3, 2, 4, 5], 2, 3],
      ['2200 records without a 2000 record', [0, 1, 3, 4, 5], 2, 3],
    ])('reports %s as parse.order', (_, order, count, line) => {
      const lines = breakdowns.split(CRLF);
      const reordered = [...order.map(index => lines[index]), ''].join(CRLF);
      const issues = parseErrorIssues(() => parse1214(reordered)).filter(
        issue => issue.ruleId === 'parse.order',
      );
      expect(issues).toHaveLength(count);
      expect(issues[0]).toEqual(expect.objectContaining({ recordType: '2200', line }));
    });

    it.each([
      ['an affiliation other than 1', SECTION, '2', SECTION],
      ['a malformed country code', SECTION + 1, 'A1B', SECTION + 1],
      ['non-zero data after the last entry', SECTION + 1023, '7', SECTION + 1023],
      ['an 11th entry', SECTION + 160, '1004000000000001', SECTION + 160],
    ])('reports %s as parse.countrySection at its column', (_, position, value, column) => {
      // Ten entries first, so that an 11th one can be added.
      const ten = generate1214(
        minimalInput({
          foreignAppendix: foreignAppendixWithBreakdown('420', {
            countries: breakdownCountries(10),
          }),
        }),
        OPTIONS,
      ).text;
      expect(parseErrorIssues(() => parse1214(tamper(ten, 4, position, value)))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.countrySection',
          line: 4,
          column,
          recordType: '2200',
          recordIndex: 0,
        }),
      ]);
    });

    it('reports a non-digit income as parse.numeric, not parse.countrySection', () => {
      expect(parseErrorIssues(() => parse1214(tamper(breakdowns, 4, SECTION + 10, 'X')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.numeric', line: 4, column: SECTION + 10 }),
      ]);
    });

    it('locates a header problem of a 2200 record at its breakdown', () => {
      expect(parseErrorIssues(() => parse1214(tamper(breakdowns, 5, 145, 'X')))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.numeric',
          path: 'foreignAppendix.countryBreakdown["439"].deductionsOffsetsAndExemptions',
          line: 5,
          column: 145,
        }),
      ]);
    });

    it.each([
      ['a code of record 2000 without a breakdown', 4, '401'],
      ['a code that is not a 2000 code', 4, '999'],
      ['no code', 4, '000'],
      ['the code of an earlier 2200 record', 5, '420'],
    ])('reports %s at 2200@137 as parse.fieldValue', (_, line, code) => {
      expect(parseErrorIssues(() => parse1214(tamper(breakdowns, line, 137, code)))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.fieldValue',
          line,
          column: 137,
          recordType: '2200',
          value: code,
        }),
      ]);
    });

    it('locates business issues of 2200 records at their breakdown', () => {
      // 2200@188: the country of the first entry of 439, '-88', turned into an unknown code.
      const result = parse1214(tamper(breakdowns, 5, SECTION + 1, '001'));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'foreign.breakdown.country.unknown',
          path: 'foreignAppendix.countryBreakdown["439"].countries[0].country',
          recordType: '2200',
          recordIndex: 1,
        }),
      ]);
    });

    it('reports 2200 records the 9999 record does not count (9999@147)', () => {
      expect(parseErrorIssues(() => parse1214(tamper(breakdowns, 6, 147, '01')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 6, column: 147 }),
      ]);
    });
  });

  describe('capital-gains appendices (30xx)', () => {
    const appendices = [
      section6Appendix(),
      section6Appendix({ foreignAsset: false, amounts: { '029': 7 } }),
    ];
    // Lines: 1000, 1020, 2000, 3063, 3063, 9999.
    const input = minimalInput({ foreignAppendix: foreignAppendix(), capitalGains: appendices });
    const file = generate1214(input, OPTIONS).text;

    it('reads the 3063 records after 2000 back as capitalGains, in file order', () => {
      const result = parse1214(file);
      expect(result.report.capitalGains).toEqual(appendices);
      expect(result.report).toEqual(canonicalize(input, OPTIONS));
      expect(result.issues).toEqual([]);
    });

    it('locates a header problem of a 3063 record at capitalGains[i]', () => {
      expect(parseErrorIssues(() => parse1214(tamper(file, 5, 143, 'X')))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.numeric',
          path: 'capitalGains[1].lossesCarriedForward',
          recordType: '3063',
          recordIndex: 1,
          line: 5,
          column: 143,
        }),
      ]);
      expect(parseErrorIssues(() => parse1214(tamper(file, 4, 142, '3')))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.fieldValue',
          path: 'capitalGains[0].foreignAsset',
          line: 4,
        }),
      ]);
    });

    it('reports a 3063 record before the 2000 record as parse.order', () => {
      const lines = file.split(CRLF);
      const reordered = [lines[0], lines[1], lines[3], lines[2], lines[4], lines[5], ''].join(CRLF);
      expect(
        parseErrorIssues(() => parse1214(reordered)).filter(
          issue => issue.ruleId === 'parse.order',
        ),
      ).toEqual([expect.objectContaining({ recordType: '2000', line: 4 })]);
    });

    it('reports capital-gains records the 9999 record does not count (9999@145)', () => {
      expect(parseErrorIssues(() => parse1214(tamper(file, 6, 145, '01')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 6, column: 145 }),
      ]);
    });

    it('reads 833 = yes back without hasCapitalGainsAppendix when appendices explain it', () => {
      expect(file.split(CRLF)[0]?.slice(832, 833)).toBe('1');
      expect(parse1214(file).report.declarations).not.toHaveProperty('hasCapitalGainsAppendix');
    });
  });

  describe('securities and REIT appendices (3060, 3064)', () => {
    // Input order 64, 60; lines: 1000, 1020, 3060, 3064, 9999.
    const input = minimalInput({
      capitalGains: [reitAppendix({ withholders: withholders(4) }), securitiesAppendix()],
    });
    const file = generate1214(input, OPTIONS).text;

    it('reads them back in file order, withholders included', () => {
      const result = parse1214(file);
      expect(result.issues).toEqual([]);
      expect(result.report.capitalGains).toEqual([
        securitiesAppendix(),
        reitAppendix({ withholders: withholders(4) }),
      ]);
      expect(result.report).toEqual(canonicalize(input, OPTIONS));
    });

    it('locates a withholder problem at capitalGains[i].withholders[j], i in file order', () => {
      // 3064@302: the branch of the fourth withholder.
      expect(parseErrorIssues(() => parse1214(tamper(file, 4, 302, 'X')))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.numeric',
          path: 'capitalGains[1].withholders[3].branch',
          recordType: '3064',
          recordIndex: 0,
          line: 4,
          column: 302,
        }),
      ]);
      // 3060@145: gainFromInvestmentFund, yes/no.
      expect(parseErrorIssues(() => parse1214(tamper(file, 3, 145, '3')))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.fieldValue',
          path: 'capitalGains[0].gainFromInvestmentFund',
          recordType: '3060',
          line: 3,
        }),
      ]);
    });

    it('reports a 3060 record after a 3064 record as parse.order', () => {
      const lines = file.split(CRLF);
      const reordered = [lines[0], lines[1], lines[3], lines[2], lines[4], ''].join(CRLF);
      expect(
        parseErrorIssues(() => parse1214(reordered)).filter(
          issue => issue.ruleId === 'parse.order',
        ),
      ).toEqual([expect.objectContaining({ recordType: '3060', line: 4 })]);
    });
  });

  describe('no-withholding appendices (3065, 3066)', () => {
    // Input order 66, 63, 65; lines: 1000, 1020, 3063, 3065, 3066, 9999.
    const input = minimalInput({
      capitalGains: [
        noWithholding1326Appendix(),
        section6Appendix(),
        noWithholding1322Appendix({ withholders: withholders(4) }),
      ],
    });
    const file = generate1214(input, OPTIONS).text;

    it('reads them back in file order, the withholding status as its literal', () => {
      const result = parse1214(file);
      expect(result.issues).toEqual([]);
      expect(result.report.capitalGains).toEqual([
        section6Appendix(),
        noWithholding1322Appendix({ withholders: withholders(4) }),
        noWithholding1326Appendix(),
      ]);
      expect(result.report).toEqual(canonicalize(input, OPTIONS));
    });

    it('reports a withholding status outside {2, 3} as field.enum at its file-order path', () => {
      // 3066@143 = 4; 3065@146 = 1.
      const result = parse1214(tamper(tamper(file, 5, 143, '4'), 4, 146, '1'));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.enum',
          path: 'capitalGains[1].withholdingStatus',
          recordType: '3065',
          recordIndex: 0,
        }),
        expect.objectContaining({
          ruleId: 'field.enum',
          path: 'capitalGains[2].withholdingStatus',
          recordType: '3066',
          recordIndex: 0,
        }),
      ]);
      expect(result.report.capitalGains?.[2]).toMatchObject({ withholdingStatus: 4 });
    });

    it('locates a 3065 withholder problem at capitalGains[i].withholders[j]', () => {
      // 3065@303: the branch of the fourth withholder (3060 has it at 302).
      expect(parseErrorIssues(() => parse1214(tamper(file, 4, 303, 'X')))).toEqual([
        expect.objectContaining({
          ruleId: 'parse.numeric',
          path: 'capitalGains[1].withholders[3].branch',
          recordType: '3065',
          line: 4,
          column: 303,
        }),
      ]);
    });
  });

  describe('other-transactions appendix (3077)', () => {
    // Input order 77, 63; lines: 1000, 1020, 3063, 3077, 9999.
    const input = minimalInput({
      capitalGains: [
        otherTransactionsAppendix({ improvements: improvements(1) }),
        section6Appendix(),
      ],
    });
    const file = generate1214(input, OPTIONS).text;

    it('reads it back in file order: improvements with code-50 amounts, replacement asset, wallet', () => {
      const result = parse1214(file);
      expect(result.issues).toEqual([]);
      expect(result.report.capitalGains).toEqual([
        section6Appendix(),
        otherTransactionsAppendix({ improvements: improvements(1) }),
      ]);
      expect(result.report).toEqual(canonicalize(input, OPTIONS));
    });

    it("reports improvement 2's expense without a date as field.required at its file-order path", () => {
      // 3077@281: the expense of improvement 2 (slot 1); its date (3077@305) stays blank. The
      // improvement count (3077@245) follows the filled slots, or the file is parse.derivedMismatch.
      const result = parse1214(tamper(tamper(file, 4, 281, '000000012345'), 4, 245, '02'));
      expect(result.issues.map(issue => [issue.ruleId, issue.path, issue.severity])).toEqual([
        ['field.required', 'capitalGains[1].improvements[1].date', 'error'],
        ['cg.improvements.code50Amount', 'capitalGains[1].improvements[1].code50Amount', 'warning'],
      ]);
      expect(result.report.capitalGains?.[1]).toMatchObject({
        improvements: [improvements(1)[0], { expense: 123.45 }],
      });
    });

    it('reports a code 071 = 1 without a wallet address as cg.virtualCurrency.wallet', () => {
      const result = parse1214(tamper(file, 4, 489, ' '.repeat(150)));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'cg.virtualCurrency.wallet',
          path: 'capitalGains[1].walletAddresses',
          recordType: '3077',
          recordIndex: 0,
        }),
      ]);
    });
  });

  describe('asset appendices (3027, 3050, 3051, 3054)', () => {
    // Input order 51, 54, 50, 27; lines: 1000, 1020, 3027, 3050, 3051, 3054, 9999.
    const input = minimalInput({
      capitalGains: [
        forcedVirtualCurrencyAppendix(),
        oilPartnershipAppendix(),
        bettermentTaxAppendix(),
        sharesAppendix(),
      ],
    });
    const file = generate1214(input, OPTIONS).text;

    it('reads them back in file order: location literals, dates, wallet addresses, ×100 codes', () => {
      const result = parse1214(file);
      expect(result.issues).toEqual([]);
      expect(result.report.capitalGains).toEqual([
        sharesAppendix(),
        bettermentTaxAppendix(),
        forcedVirtualCurrencyAppendix(),
        oilPartnershipAppendix(),
      ]);
      expect(result.report).toEqual(canonicalize(input, OPTIONS));
    });

    it('reports a blank required date as field.required at its file-order path', () => {
      // 3050@193 purchase date, 3051@224 and 3054@202 code-15 dates; 3027@225 is optional.
      const blank = ' '.repeat(10);
      const tampered = tamper(
        tamper(tamper(tamper(file, 4, 193, blank), 5, 224, blank), 6, 202, blank),
        3,
        225,
        blank,
      );
      const result = parse1214(tampered);
      expect(result.issues.map(issue => [issue.ruleId, issue.path, issue.recordType])).toEqual([
        ['field.required', 'capitalGains[1].purchaseDate', '3050'],
        ['field.required', 'capitalGains[2].dates.code15', '3051'],
        ['field.required', 'capitalGains[3].dates.code15', '3054'],
      ]);
      expect(result.report.capitalGains?.[0]).toMatchObject({
        dates: { code20: '2015-06-01', code53: '2010-01-31' },
      });
      expect(result.report.capitalGains?.[1]).not.toHaveProperty('purchaseDate');
    });

    it('locates a 3051 wallet-address or location problem at capitalGains[i]', () => {
      // 3051@192 location 3 (allowed: 1, 2).
      expect(parse1214(tamper(file, 5, 192, '3')).issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.enum',
          path: 'capitalGains[2].assetLocation',
          recordType: '3051',
          recordIndex: 0,
        }),
      ]);
      // A control character in the second wallet slot (3051@386–535).
      expect(parse1214(tamper(file, 5, 535, '\u0001')).issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.charset',
          path: 'capitalGains[2].walletAddresses[1]',
          recordType: '3051',
        }),
      ]);
    });
  });

  it.each([
    'minimal',
    'foreign',
    'cg-27',
    'cg-50',
    'cg-51',
    'cg-54',
    'cg-63',
    'cg-60',
    'cg-64',
    'cg-65',
    'cg-66',
    'cg-77',
    'capital-gains-max',
  ])('never lets anything but Opcn1214ParseError escape for a corrupted %s golden', name => {
    const golden = goldenText(name);
    const lines = golden.split(CRLF);
    for (const [index, line] of lines.entries()) {
      for (let position = 1; position <= line.length; position += 37) {
        for (const value of ['X', ' ', '9', '\u05D0']) {
          const corrupted = tamper(golden, index + 1, position, value);
          try {
            parse1214(corrupted);
          } catch (error) {
            expect(error).toBeInstanceOf(Opcn1214ParseError);
            for (const issue of (error as Opcn1214ParseError).issues) {
              expect(issue.line).toBeGreaterThan(0);
              expect(issue.column).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});

describe('parse1214: declarations rebuilt from their flags (SPEC §7.3)', () => {
  const { text: declared } = generate1214(
    minimalInput({
      declarations: {
        tookReportablePosition: true,
        reportablePositions: [12, 7, 5],
        familyCompany: { representativeFileNumber: '300000007' },
      },
      amounts: { '080': 0 },
    }),
    OPTIONS,
  );

  it('drops a member whose flag is not marked (836 = 0, 837 filled)', () => {
    const { report } = parse1214(tamper(declared, 1, 836, '0'));
    expect(report.declarations).not.toHaveProperty('familyCompany');
  });

  it('keeps a marked object whose member is written as absent (837 = 0)', () => {
    const { report } = parse1214(tamper(declared, 1, 837, '000000000'));
    expect(report.declarations.familyCompany).toEqual({});
  });

  it('reads the reportable positions as the non-zero values in field order', () => {
    const { report } = parse1214(tamper(declared, 1, 1037, '000'));
    expect(report.declarations.reportablePositions).toEqual([12, 5]);
  });
});
