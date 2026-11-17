/**
 * What each golden fixture claims to cover (SPEC §13.5), checked on its input and generated file.
 */
import { generate1214, parse1214, validate1214 } from '../../src/index.js';
import { getLayout } from '../../src/layout/registry.js';
import { COUNTRY_BREAKDOWN_CODES } from '../../src/model/codes.generated.js';
import { normalizeReport } from '../../src/normalize/report.js';
import * as capitalGainsMax from '../fixtures/golden/capital-gains-max.input.js';
import * as cg27 from '../fixtures/golden/cg-27.input.js';
import * as cg50 from '../fixtures/golden/cg-50.input.js';
import * as cg51 from '../fixtures/golden/cg-51.input.js';
import * as cg54 from '../fixtures/golden/cg-54.input.js';
import * as cg60 from '../fixtures/golden/cg-60.input.js';
import * as cg63 from '../fixtures/golden/cg-63.input.js';
import * as cg64 from '../fixtures/golden/cg-64.input.js';
import * as cg65 from '../fixtures/golden/cg-65.input.js';
import * as cg66 from '../fixtures/golden/cg-66.input.js';
import * as cg77 from '../fixtures/golden/cg-77.input.js';
import * as foreign from '../fixtures/golden/foreign.input.js';
import * as kibbutz from '../fixtures/golden/kibbutz.input.js';
import * as mainFull from '../fixtures/golden/main-full.input.js';
import * as relatedAndRd from '../fixtures/golden/related-and-rd.input.js';
import { unmappedHeaderKeys } from '../helpers/coverage.js';

const LAYOUT = getLayout(2024);

function linesOf(text: string): string[] {
  return text.split('\r\n').filter(line => line !== '');
}

describe('golden main-full', () => {
  const { input, options } = mainFull;

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('sets every non-filler header field of record 1000', () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records['1000'], report.records)).toEqual([]);
  });

  it('holds exactly 61 code-amount pairs after derivations, without code 165', () => {
    const report = normalizeReport(input, LAYOUT, options);
    const codes = report.records[0]?.codes;
    expect(codes?.size).toBe(LAYOUT.limits.mainCodePairs);
    expect(codes?.has('165')).toBe(false);
    expect([...(codes?.keys() ?? [])]).toEqual(
      expect.arrayContaining(['008', '028', '273', '277', '278', '280', '297']),
    );
  });

  it('has a bank account and 99 shareholders whose dividend rights total 100', () => {
    expect(input.bankAccount).toBeDefined();
    expect(input.declarations.isKibbutz).not.toBe(true);
    expect(input.declarations.hasCapitalGainsAppendix).toBeUndefined();
    expect(input.shareholders).toHaveLength(99);
    const hundredths = input.shareholders.reduce(
      (sum, shareholder) => sum + Math.round((shareholder.dividendRightsPercent ?? 0) * 100),
      0,
    );
    expect(hundredths).toBe(10_000);
  });

  it('writes 1000 + 99 × 1020 + 9999, counting 99 shareholders (9999@141)', () => {
    const lines = linesOf(generate1214(input, options).text);
    expect(lines).toHaveLength(101);
    expect(lines.slice(1, 100).every(line => line.slice(4, 8) === '1020')).toBe(true);
    expect(lines[100]?.slice(140, 142)).toBe('99');
  });
});

describe('golden kibbutz', () => {
  const { input, options } = kibbutz;

  it('is a kibbutz with code 226 and no shareholders, valid without warnings', () => {
    expect(input.declarations.isKibbutz).toBe(true);
    expect(input.amounts['226']).toBe(1);
    expect(input.shareholders).toEqual([]);
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('writes 1000 + 9999 only, counting 00 shareholders (9999@141), and parses back', () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '9999']);
    expect(lines[1]?.slice(140, 142)).toBe('00');
    // 1000@877: the kibbutz flag.
    expect(lines[0]?.slice(876, 877)).toBe('1');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.shareholders).toEqual([]);
  });
});

describe('golden related-and-rd', () => {
  const { input, options } = relatedAndRd;

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('has 3 related companies and 5 R&D investments whose total is code 165', () => {
    expect(input.relatedCompanies).toHaveLength(3);
    expect(input.rdInvestments).toHaveLength(5);
    const total = (input.rdInvestments ?? []).reduce(
      (sum, investment) => sum + investment.investmentAmount,
      0,
    );
    expect(input.amounts['165']).toBe(total);
  });

  it('writes 1000, 3 × 1010, 1020, 5 × 1030, 9999, counted at 9999@139 and @149', () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1010',
      '1010',
      '1010',
      '1020',
      '1030',
      '1030',
      '1030',
      '1030',
      '1030',
      '9999',
    ]);
    expect(lines[10]?.slice(138, 140)).toBe('03');
    expect(lines[10]?.slice(148, 150)).toBe('05');
    // 1030@137: affiliation 1 (company) on every record.
    expect(lines.slice(5, 10).map(line => line.slice(136, 137))).toEqual(['1', '1', '1', '1', '1']);
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.rdInvestments).toEqual(input.rdInvestments);
  });
});

describe('golden foreign', () => {
  const { input, options } = foreign;
  const appendix = input.foreignAppendix;

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('writes every per-country code, each with one breakdown, -88 on 439, ten countries on 420', () => {
    const written = Object.keys(appendix?.amounts ?? {});
    expect(COUNTRY_BREAKDOWN_CODES.filter(code => !written.includes(code))).toEqual([]);
    expect(Object.keys(appendix?.countryBreakdown ?? {}).sort()).toEqual([
      ...COUNTRY_BREAKDOWN_CODES,
    ]);
    expect(appendix?.countryBreakdown?.['439']?.countries).toContainEqual(
      expect.objectContaining({ country: '-88' }),
    );
    expect(appendix?.countryBreakdown?.['420']?.countries).toHaveLength(
      LAYOUT.limits.countriesPerRecord,
    );
  });

  it('sets every non-filler header field of records 2000 and 2200', () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records['2000'], report.records)).toEqual([]);
    expect(unmappedHeaderKeys(LAYOUT.records['2200'], report.records)).toEqual([]);
  });

  it('writes 1000, 1020, 2000 and 23 × 2200 sorted by code, counted at 9999@143 and @147', () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1020',
      '2000',
      ...COUNTRY_BREAKDOWN_CODES.map(() => '2200'),
      '9999',
    ]);
    // 2200@137: the code each record breaks down, ascending.
    expect(lines.slice(3, -1).map(line => line.slice(136, 139))).toEqual([
      ...COUNTRY_BREAKDOWN_CODES,
    ]);
    expect(lines.at(-1)?.slice(142, 144)).toBe('01');
    expect(lines.at(-1)?.slice(146, 148)).toBe('23');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.foreignAppendix).toEqual(appendix);
  });
});

describe('golden cg-63', () => {
  const { input, options } = cg63;

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('has one 3063 appendix with every code of record 3063', () => {
    expect(input.capitalGains).toHaveLength(1);
    const [appendix] = input.capitalGains ?? [];
    expect(appendix?.symbol).toBe(63);
    expect(Object.keys(appendix?.amounts ?? {}).sort()).toEqual(
      LAYOUT.records['3063'].codes.map(code => code.code),
    );
  });

  it('sets every non-filler header field of record 3063', () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records['3063'], report.records)).toEqual([]);
  });

  it('writes 1000, 1020, 3063, 9999 with 833 = yes, code 028 = 1 and 9999@145 = 01', () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', '3063', '9999']);
    expect(lines[0]?.slice(832, 833)).toBe('1');
    expect(lines[0]?.slice(2184)).toContain('02801');
    // 3063@137: symbol 63; 3063@139: appendix number 1.
    expect(lines[2]?.slice(136, 141)).toBe('63001');
    expect(lines[3]?.slice(144, 146)).toBe('01');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual(input.capitalGains);
  });
});

describe.each([
  ['cg-60', cg60, '3060'],
  ['cg-64', cg64, '3064'],
] as const)('golden %s', (_name, fixture, type) => {
  const { input, options } = fixture;
  const symbol = Number(type.slice(2));

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it(`has one ${type} appendix with four withholders and every code of record ${type}`, () => {
    expect(input.capitalGains).toHaveLength(1);
    const [appendix] = input.capitalGains ?? [];
    expect(appendix?.symbol).toBe(symbol);
    expect(appendix && 'withholders' in appendix ? appendix.withholders : []).toHaveLength(4);
    expect(Object.keys(appendix?.amounts ?? {}).sort()).toEqual(
      LAYOUT.records[type].codes.map(code => code.code).sort(),
    );
  });

  it(`sets every non-filler header field of record ${type}`, () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records[type], report.records)).toEqual([]);
  });

  it(`writes 1000, 1020, ${type}, 9999 with 833 = yes, code 028 = 1 and 9999@145 = 01`, () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', type, '9999']);
    expect(lines[0]?.slice(832, 833)).toBe('1');
    expect(lines[0]?.slice(2184)).toContain('02801');
    // 30xx@137: the symbol; 30xx@139: appendix number 1.
    expect(lines[2]?.slice(136, 141)).toBe(`${symbol}001`);
    expect(lines[3]?.slice(144, 146)).toBe('01');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual(input.capitalGains);
  });
});

describe.each([
  ['cg-65', cg65, '3065', 146, 325, '3'],
  ['cg-66', cg66, '3066', 143, 154, '2'],
] as const)('golden %s', (_name, fixture, type, statusPosition, sequencePosition, status) => {
  const { input, options } = fixture;
  const symbol = Number(type.slice(2));

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it(`has one ${type} appendix with a withholding status and every code of record ${type}`, () => {
    expect(input.capitalGains).toHaveLength(1);
    const [appendix] = input.capitalGains ?? [];
    expect(appendix?.symbol).toBe(symbol);
    expect(appendix).toHaveProperty('withholdingStatus');
    if (type === '3065') {
      expect(appendix && 'withholders' in appendix ? appendix.withholders : []).toHaveLength(4);
    }
    expect(Object.keys(appendix?.amounts ?? {}).sort()).toEqual(
      LAYOUT.records[type].codes.map(code => code.code).sort(),
    );
  });

  it(`sets every non-filler header field of record ${type}`, () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records[type], report.records)).toEqual([]);
  });

  it(`writes 1000, 1020, ${type}, 9999 with the status at ${statusPosition} and sequence 01 at ${sequencePosition}`, () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', type, '9999']);
    expect(lines[0]?.slice(832, 833)).toBe('1');
    expect(lines[0]?.slice(2184)).toContain('02801');
    expect(lines[2]?.slice(136, 141)).toBe(`${symbol}001`);
    expect(lines[2]?.slice(statusPosition - 1, statusPosition)).toBe(status);
    expect(lines[2]?.slice(sequencePosition - 1, sequencePosition + 1)).toBe('01');
    expect(lines[3]?.slice(144, 146)).toBe('01');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual(input.capitalGains);
  });
});

describe.each([
  ['cg-27', cg27, '3027', 255],
  ['cg-50', cg50, '3050', undefined],
  ['cg-54', cg54, '3054', undefined],
  ['cg-51', cg51, '3051', 234],
] as const)('golden %s', (_name, fixture, type, sequencePosition) => {
  const { input, options } = fixture;
  const symbol = Number(type.slice(2));

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it(`has one ${type} appendix with every code of record ${type}`, () => {
    expect(input.capitalGains).toHaveLength(1);
    const [appendix] = input.capitalGains ?? [];
    expect(appendix?.symbol).toBe(symbol);
    if (type === '3051') {
      expect(
        appendix && 'walletAddresses' in appendix ? appendix.walletAddresses : [],
      ).toHaveLength(2);
    }
    expect(Object.keys(appendix?.amounts ?? {}).sort()).toEqual(
      LAYOUT.records[type].codes.map(code => code.code).sort(),
    );
  });

  it(`sets every non-filler header field of record ${type}`, () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records[type], report.records)).toEqual([]);
  });

  it(`writes 1000, 1020, ${type}, 9999 with the symbol, appendix number and any sequence`, () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', type, '9999']);
    expect(lines[0]?.slice(832, 833)).toBe('1');
    expect(lines[0]?.slice(2184)).toContain('02801');
    expect(lines[2]?.slice(136, 141)).toBe(`${symbol}001`);
    if (sequencePosition !== undefined) {
      expect(lines[2]?.slice(sequencePosition - 1, sequencePosition + 1)).toBe('01');
    }
    expect(lines[3]?.slice(144, 146)).toBe('01');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual(input.capitalGains);
  });
});

describe('golden cg-77', () => {
  const { input, options } = cg77;

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('has one 3077 appendix with five improvements, each with its code-50 amount, and every input code', () => {
    expect(input.capitalGains).toHaveLength(1);
    const [appendix] = input.capitalGains ?? [];
    if (appendix?.symbol !== 77) {
      throw new Error('expected a 3077 appendix');
    }
    expect(appendix.improvements).toHaveLength(5);
    for (const improvement of appendix.improvements ?? []) {
      expect(Object.keys(improvement).sort()).toEqual(
        ['accumulatedDepreciation', 'code50Amount', 'date', 'expense'].sort(),
      );
    }
    expect(appendix.walletAddresses).toHaveLength(2);
    expect(Object.keys(appendix.replacementAsset ?? {}).sort()).toEqual([
      'details',
      'price',
      'purchaseDate',
    ]);
    expect(appendix.amounts['071']).toBe(1);
    expect(Object.keys(appendix.amounts).sort()).toEqual(
      LAYOUT.records['3077'].codes
        .filter(code => !code.derived)
        .map(code => code.code)
        .sort(),
    );
  });

  it('sets every non-filler header field and every code of record 3077', () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records['3077'], report.records)).toEqual([]);
    const record = report.records.find(r => r.recordType === '3077');
    expect([...(record?.codes.keys() ?? [])].sort()).toEqual(
      LAYOUT.records['3077'].codes.map(code => code.code).sort(),
    );
  });

  it('writes 1000, 1020, 3077, 9999 with the count 05 at 245 and sequence 01 at 487', () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '1020', '3077', '9999']);
    expect(lines[0]?.slice(832, 833)).toBe('1');
    expect(lines[0]?.slice(2184)).toContain('02801');
    expect(lines[2]?.slice(136, 141)).toBe('77001');
    expect(lines[2]?.slice(244, 246)).toBe('05');
    expect(lines[2]?.slice(486, 488)).toBe('01');
    expect(lines[2]?.slice(1160)).toContain('501000009600025');
    expect(lines[2]?.slice(1160)).toContain('505000001470099');
    expect(lines[3]?.slice(144, 146)).toBe('01');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual(input.capitalGains);
  });
});

describe('golden capital-gains-max', () => {
  const { input, options } = capitalGainsMax;
  /** Record type → position of its "מספר בתל"ם" sequence field (SPEC §7.4). */
  const SEQUENCE_POSITIONS: Readonly<Record<string, number>> = {
    '3027': 255,
    '3051': 234,
    '3065': 325,
    '3066': 154,
    '3077': 487,
  };

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('has exactly 14 appendices covering all ten types, given out of type order', () => {
    const symbols = (input.capitalGains ?? []).map(appendix => appendix.symbol);
    expect(symbols).toHaveLength(14);
    expect([...new Set(symbols)].sort((a, b) => a - b)).toEqual([
      27, 50, 51, 54, 60, 63, 64, 65, 66, 77,
    ]);
    expect(symbols).not.toEqual([...symbols].sort((a, b) => a - b));
    expect(input.capitalGainsSummary).toBeUndefined();
  });

  it('groups the records by type, numbers appendices per symbol and the sequence across all', () => {
    const lines = linesOf(generate1214(input, options).text);
    const appendixLines = lines.slice(2, -1);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1020',
      '3027',
      '3027',
      '3050',
      '3051',
      '3054',
      '3060',
      '3060',
      '3063',
      '3064',
      '3065',
      '3066',
      '3077',
      '3077',
      '3077',
      '9999',
    ]);
    expect(appendixLines.map(line => line.slice(136, 141))).toEqual([
      '27001',
      '27002',
      '50001',
      '51001',
      '54001',
      '60001',
      '60002',
      '63001',
      '64001',
      '65001',
      '66001',
      '77001',
      '77002',
      '77003',
    ]);
    expect(
      appendixLines.flatMap((line, index) => {
        const position = SEQUENCE_POSITIONS[line.slice(4, 8)];
        return position === undefined
          ? []
          : [[line.slice(4, 8), line.slice(position - 1, position + 1), index + 1]];
      }),
    ).toEqual([
      ['3027', '01', 1],
      ['3027', '02', 2],
      ['3051', '04', 4],
      ['3065', '10', 10],
      ['3066', '11', 11],
      ['3077', '12', 12],
      ['3077', '13', 13],
      ['3077', '14', 14],
    ]);
  });

  it('derives 833 = yes, code 028 = 14 and 9999@145 = 14', () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(report.records[0]?.codes.get('028')).toBe(14);
    const lines = linesOf(generate1214(input, options).text);
    expect(lines[0]?.slice(832, 833)).toBe('1');
    expect(lines[0]?.slice(2184)).toContain('02814');
    expect(lines.at(-1)?.slice(144, 146)).toBe('14');
  });

  it('parses back in file order, grouped by type', () => {
    const parsed = parse1214(generate1214(input, options).text);
    expect(parsed.issues).toEqual([]);
    const appendices = input.capitalGains ?? [];
    expect(parsed.report.capitalGains).toEqual(
      [2, 9, 7, 4, 10, 3, 12, 1, 11, 6, 8, 0, 5, 13].map(index => appendices[index]),
    );
  });
});
