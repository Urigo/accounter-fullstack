import { renderReport } from '../../src/file/assemble.js';
import { generate1214, parse1214, validate1214 } from '../../src/index.js';
import {
  capitalGainsRecordType,
  isCapitalGainsRecordType,
} from '../../src/layout/capital-gains.js';
import { getLayout } from '../../src/layout/registry.js';
import type { Report1214Input } from '../../src/model/input.js';
import type { ValidateOptions } from '../../src/model/options.js';
import { placeCapitalGains } from '../../src/normalize/capital-gains/index.js';
import { normalizeReport } from '../../src/normalize/report.js';
import {
  breakdownCountries,
  foreignAppendixWithBreakdown,
  minimalInput,
  rdInvestments,
  rdInvestmentsTotal,
  reitAppendix,
  section6Appendices,
  section6Appendix,
  securitiesAppendix,
  withholders,
} from '../fixtures/builders.js';
import { unmappedHeaderKeys } from '../helpers/coverage.js';

const LAYOUT = getLayout(2024);
const OPTIONS: ValidateOptions = { today: () => '2024-06-30' };

function reportOf(input: Report1214Input, options = OPTIONS) {
  return normalizeReport(input, LAYOUT, options);
}

function capitalGainsRecords(input: Report1214Input, options = OPTIONS) {
  return reportOf(input, options).records.filter(r => isCapitalGainsRecordType(r.recordType));
}

function mainOf(input: Report1214Input) {
  const main = reportOf(input).records[0];
  if (main?.recordType !== '1000') {
    throw new Error('expected record 1000 first');
  }
  return main;
}

/** The lines of the file of `input`, 9999 last. */
function linesOf(input: Report1214Input): string[] {
  return renderReport(reportOf(input)).lines;
}

/** The `length` characters of `line` at the 1-based layout `position`. */
function at(line: string | undefined, position: number, length: number): string | undefined {
  return line?.slice(position - 1, position - 1 + length);
}

describe('capital-gains record types (SPEC §3.7)', () => {
  it('maps a symbol to its record type, 3000 + symbol', () => {
    expect(capitalGainsRecordType(63)).toBe('3063');
    expect(capitalGainsRecordType(27)).toBe('3027');
  });

  it('recognizes the ten capital-gains record types only', () => {
    const types = Object.keys(LAYOUT.records).filter(type =>
      isCapitalGainsRecordType(type as keyof typeof LAYOUT.records),
    );
    expect(types).toEqual([
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
    ]);
  });
});

describe('placeCapitalGains (SPEC §3.3, §7.4, §15 A-7)', () => {
  const appendices = [
    { symbol: 77, name: 'a' },
    { symbol: 63, name: 'b' },
    { symbol: 77, name: 'c' },
    { symbol: 27, name: 'd' },
    { symbol: 63, name: 'e' },
  ];

  it('groups by record type ascending, input order within a type', () => {
    expect(placeCapitalGains(appendices).map(placed => placed.appendix.name)).toEqual([
      'd',
      'b',
      'e',
      'a',
      'c',
    ]);
  });

  it('keeps the input index of every appendix', () => {
    expect(placeCapitalGains(appendices).map(placed => placed.inputIndex)).toEqual([3, 1, 4, 0, 2]);
  });

  it('numbers appendices per symbol (30xx@139), 1-based in emission order', () => {
    expect(placeCapitalGains(appendices).map(placed => placed.appendixNumber)).toEqual([
      1, 1, 2, 1, 2,
    ]);
  });

  it('numbers the "מספר בתל"ם" sequence across all appendices, 1-based in emission order', () => {
    expect(placeCapitalGains(appendices).map(placed => placed.sequenceNumber)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('places nothing for no appendices', () => {
    expect(placeCapitalGains([])).toEqual([]);
  });
});

describe('normalizeReport: record 3063 (securities under section 6)', () => {
  it('maps the header and the codes, with paths capitalGains[i].<key> and amounts["NNN"]', () => {
    const [record] = capitalGainsRecords(minimalInput({ capitalGains: [section6Appendix()] }));
    expect(record?.recordType).toBe('3063');
    expect(record?.index).toBe(0);
    expect(record?.inputIndex).toBe(0);
    expect(record?.values).toEqual({
      transactionSymbol: 63,
      appendixNumber: 1,
      foreignAsset: true,
      lossesCarriedForward: 12_000,
    });
    expect([...(record?.codes ?? [])]).toEqual([
      ['022', 50_000],
      ['056', 3000],
    ]);
    expect(record?.countries).toEqual([]);
    expect(record?.paths).toEqual({
      transactionSymbol: '',
      appendixNumber: '',
      foreignAsset: 'capitalGains[0].foreignAsset',
      lossesCarriedForward: 'capitalGains[0].lossesCarriedForward',
      'code:022': 'capitalGains[0].amounts["022"]',
      'code:056': 'capitalGains[0].amounts["056"]',
    });
  });

  it('sets every non-filler header field of record 3063', () => {
    const report = reportOf(minimalInput({ capitalGains: [section6Appendix()] }));
    expect(unmappedHeaderKeys(LAYOUT.records['3063'], report.records)).toEqual([]);
  });

  it('writes the symbol at 137 and the appendix number at 139, the section at 1161', () => {
    const lines = linesOf(minimalInput({ capitalGains: [section6Appendix()] }));
    const line = lines.find(text => text.slice(4, 8) === '3063');
    expect(at(line, 137, 2)).toBe('63');
    expect(at(line, 139, 3)).toBe('001');
    expect(at(line, 142, 1)).toBe('1');
    expect(at(line, 143, 10)).toBe('0000012000');
    expect(at(line, 1161, 26)).toBe('0220000050000' + '0560000003000');
    expect(line?.slice(1186)).toMatch(/^0+$/);
  });

  it('writes foreignAsset false as 2 (no) and an absent one as 0', () => {
    const [no] = linesOf(
      minimalInput({ capitalGains: [section6Appendix({ foreignAsset: false })] }),
    ).filter(text => text.slice(4, 8) === '3063');
    expect(at(no, 142, 1)).toBe('2');
    const [absent] = linesOf(minimalInput({ capitalGains: [{ symbol: 63, amounts: {} }] })).filter(
      text => text.slice(4, 8) === '3063',
    );
    expect(at(absent, 142, 1)).toBe('0');
    expect(at(absent, 143, 10)).toBe('0'.repeat(10));
  });

  it('numbers two 3063 appendices 1 and 2, in input order, with their input index', () => {
    const records = capitalGainsRecords(minimalInput({ capitalGains: section6Appendices(2) }));
    expect(records.map(r => [r.index, r.inputIndex, r.values.appendixNumber])).toEqual([
      [0, 0, 1],
      [1, 1, 2],
    ]);
    expect(records[1]?.codes.get('022')).toBe(2000);
    expect(records[1]?.paths['code:022']).toBe('capitalGains[1].amounts["022"]');
    const lines = linesOf(minimalInput({ capitalGains: section6Appendices(2) }));
    expect(lines.filter(text => text.slice(4, 8) === '3063').map(text => at(text, 139, 3))).toEqual(
      ['001', '002'],
    );
  });

  it('omits zero codes (none of 3063 is zeroAllowed) and lists them by record index', () => {
    const report = reportOf(
      minimalInput({
        capitalGains: [
          section6Appendix(),
          section6Appendix({ amounts: { '022': 0, '023': 0, '026': 5 } }),
        ],
      }),
    );
    const second = report.records.filter(r => r.recordType === '3063')[1];
    expect([...(second?.codes.keys() ?? [])]).toEqual(['026', '056']);
    expect(report.omittedZeroCodes).toEqual([
      { record: '3063', recordIndex: 1, code: '022' },
      { record: '3063', recordIndex: 1, code: '023' },
    ]);
  });

  it('rounds the losses and the codes per options.rounding', () => {
    const [record] = capitalGainsRecords(
      minimalInput({
        capitalGains: [section6Appendix({ lossesCarriedForward: 99.5, amounts: { '022': 0.4 } })],
      }),
      { ...OPTIONS, rounding: 'halfUp' },
    );
    expect(record?.values.lossesCarriedForward).toBe(100);
    expect(record?.codes.has('022')).toBe(false);
  });

  it('emits the capital-gains records after 1030, 2000 and 2200', () => {
    const report = reportOf(
      minimalInput({
        rdInvestments: rdInvestments(1),
        amounts: { '165': rdInvestmentsTotal(1) },
        foreignAppendix: foreignAppendixWithBreakdown('420', {
          countries: breakdownCountries(1),
        }),
        capitalGains: section6Appendices(2),
      }),
    );
    expect(report.records.map(r => [r.recordType, r.index])).toEqual([
      ['1000', 0],
      ['1020', 0],
      ['1030', 0],
      ['2000', 0],
      ['2200', 0],
      ['3063', 0],
      ['3063', 1],
    ]);
  });

  it('emits no capital-gains record without appendices or for an empty list', () => {
    expect(capitalGainsRecords(minimalInput())).toEqual([]);
    expect(capitalGainsRecords(minimalInput({ capitalGains: [] }))).toEqual([]);
  });
});

describe('1000@833, code 028 and 9999@145 from the appendices (SPEC §7.4)', () => {
  it('833 = yes when any appendix exists', () => {
    const main = mainOf(minimalInput({ capitalGains: [section6Appendix()] }));
    expect(main.values['declarations.hasCapitalGainsAppendix']).toBe(true);
    expect(at(linesOf(minimalInput({ capitalGains: [section6Appendix()] }))[0], 833, 1)).toBe('1');
  });

  it('833 = no without appendices, untransmitted count or override', () => {
    expect(mainOf(minimalInput({ capitalGains: [] })).values).toMatchObject({
      'declarations.hasCapitalGainsAppendix': false,
    });
  });

  it('code 028 = appendices + untransmittedCount', () => {
    const main = mainOf(
      minimalInput({
        capitalGains: section6Appendices(2),
        capitalGainsSummary: { untransmittedCount: 3, reasons: { lossOrNoGain: true } },
      }),
    );
    expect(main.codes.get('028')).toBe(5);
    expect(main.paths['code:028']).toBe('');
  });

  it('code 028 = the number of appendices without untransmitted ones', () => {
    expect(mainOf(minimalInput({ capitalGains: section6Appendices(2) })).codes.get('028')).toBe(2);
    expect(mainOf(minimalInput()).codes.has('028')).toBe(false);
  });

  it('9999@145 counts the capital-gains appendices', () => {
    expect(at(linesOf(minimalInput({ capitalGains: section6Appendices(3) })).at(-1), 145, 2)).toBe(
      '03',
    );
    expect(at(linesOf(minimalInput()).at(-1), 145, 2)).toBe('00');
  });

  it('raises main.capitalGains.flag when hasCapitalGainsAppendix is false while appendices exist', () => {
    const report = reportOf(
      minimalInput({
        declarations: { hasCapitalGainsAppendix: false },
        capitalGains: [section6Appendix()],
      }),
    );
    expect(report.notices).toEqual([
      expect.objectContaining({
        ruleId: 'main.capitalGains.flag',
        severity: 'error',
        path: 'declarations.hasCapitalGainsAppendix',
        recordType: '1000',
        recordIndex: 0,
        value: false,
      }),
    ]);
    // 833 itself is derived: yes.
    expect(report.records[0]?.values['declarations.hasCapitalGainsAppendix']).toBe(true);
  });

  it('raises no notice for false without appendices, or true with appendices', () => {
    const noticesOf = (overrides: Parameters<typeof minimalInput>[0]) =>
      reportOf(minimalInput(overrides)).notices;
    expect(noticesOf({ declarations: { hasCapitalGainsAppendix: false } })).toEqual([]);
    expect(
      noticesOf({
        declarations: { hasCapitalGainsAppendix: true },
        capitalGains: [section6Appendix()],
      }),
    ).toEqual([]);
  });
});

/** The lines of record type `type` in the file of `input`. */
function linesOfType(input: Report1214Input, type: string): string[] {
  return linesOf(input).filter(text => text.slice(4, 8) === type);
}

describe.each([
  ['3060', 'securities', securitiesAppendix],
  ['3064', 'REIT', reitAppendix],
] as const)('normalizeReport: record %s (%s, with withholders)', (type, _name, build) => {
  const def = LAYOUT.records[type];

  it('has the shared securities header, the same keys at the same positions as the other type', () => {
    const other = LAYOUT.records[type === '3060' ? '3064' : '3060'];
    const shape = (fields: typeof def.fields) =>
      fields.filter(f => f.kind !== 'filler').map(f => [f.key, f.position, f.length, f.kind]);
    expect(shape(def.fields)).toEqual(shape(other.fields));
    // No "מספר בתל"ם" sequence field: the header is symbol, appendix number, members only.
    expect(def.fields.filter(f => f.kind !== 'filler').map(f => f.key)).toEqual([
      'transactionSymbol',
      'appendixNumber',
      'foreignAsset',
      'soldToRelatedParty',
      'boughtFromRelatedParty',
      'gainFromInvestmentFund',
      ...[0, 1, 2, 3].flatMap(i => [
        `withholders[${i}].name`,
        `withholders[${i}].branch`,
        `withholders[${i}].account`,
      ]),
      'lossesCarriedForward',
    ]);
  });

  it('maps the header, withholders[j] to keys withholders[j].<member>, with input paths', () => {
    const appendix = build({ withholders: withholders(2) });
    const [record] = capitalGainsRecords(minimalInput({ capitalGains: [appendix] }));
    expect(record?.recordType).toBe(type);
    expect(record?.inputIndex).toBe(0);
    expect(record?.values).toEqual({
      transactionSymbol: Number(type.slice(2)),
      appendixNumber: 1,
      foreignAsset: appendix.foreignAsset,
      soldToRelatedParty: appendix.soldToRelatedParty,
      boughtFromRelatedParty: appendix.boughtFromRelatedParty,
      gainFromInvestmentFund: appendix.gainFromInvestmentFund,
      'withholders[0].name': 'בנק הפועלים',
      'withholders[0].branch': '011',
      'withholders[0].account': '000123450',
      'withholders[1].name': 'בנק לאומי',
      'withholders[1].branch': '012',
      'withholders[1].account': '000123451',
      lossesCarriedForward: appendix.lossesCarriedForward,
    });
    expect(record?.paths).toMatchObject({
      transactionSymbol: '',
      appendixNumber: '',
      foreignAsset: 'capitalGains[0].foreignAsset',
      gainFromInvestmentFund: 'capitalGains[0].gainFromInvestmentFund',
      'withholders[1].name': 'capitalGains[0].withholders[1].name',
      'withholders[1].branch': 'capitalGains[0].withholders[1].branch',
      'withholders[1].account': 'capitalGains[0].withholders[1].account',
      lossesCarriedForward: 'capitalGains[0].lossesCarriedForward',
      'code:056': 'capitalGains[0].amounts["056"]',
    });
  });

  it('sets every non-filler header field with four withholders', () => {
    const report = reportOf(
      minimalInput({ capitalGains: [build({ withholders: withholders(4) })] }),
    );
    expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
  });

  it('writes the header at its layout positions', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [
          build({
            foreignAsset: true,
            soldToRelatedParty: false,
            boughtFromRelatedParty: true,
            gainFromInvestmentFund: false,
            withholders: [{}, { name: 'בנק', branch: '12', account: '345' }],
            lossesCarriedForward: 777,
          }),
        ],
      }),
      type,
    );
    expect(at(line, 137, 2)).toBe(type.slice(2));
    expect(at(line, 139, 3)).toBe('001');
    expect(at(line, 142, 4)).toBe('1212');
    // Slot 0 is empty; slot 1 at 188 (name, padded on the left), 218 (branch), 221 (account).
    expect(at(line, 146, 42)).toBe(' '.repeat(30) + '0'.repeat(12));
    expect(at(line, 188, 30)).toBe('בנק'.padStart(30, ' '));
    expect(at(line, 218, 3)).toBe('012');
    expect(at(line, 221, 9)).toBe('000000345');
    expect(at(line, 230, 84)).toBe((' '.repeat(30) + '0'.repeat(12)).repeat(2));
    expect(at(line, 314, 10)).toBe('0000000777');
  });

  it('writes gainFromInvestmentFund as yes/no {1, 2} (SPEC §15 A-8)', () => {
    const flag = (gainFromInvestmentFund: boolean | undefined) =>
      at(
        linesOfType(minimalInput({ capitalGains: [build({ gainFromInvestmentFund })] }), type)[0],
        145,
        1,
      );
    expect(flag(true)).toBe('1');
    expect(flag(false)).toBe('2');
    expect(flag(undefined)).toBe('0');
    expect(def.fields.find(f => f.key === 'gainFromInvestmentFund')?.kind).toBe('yesNo');
  });

  it('reports a withholder name that does not start with a Hebrew letter at its input path', () => {
    const input = minimalInput({
      capitalGains: [
        build({ withholders: [...withholders(2), { name: 'Bank Hapoalim', branch: '1' }] }),
      ],
    });
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'capitalGains[0].withholders[2].name',
        recordType: type,
        recordIndex: 0,
      }),
    ]);
  });

  it('accepts four withholders and empty slots without issues', () => {
    expect(
      validate1214(
        minimalInput({ capitalGains: [build({ withholders: withholders(4) })] }),
        OPTIONS,
      ),
    ).toEqual({ valid: true, errors: [], warnings: [] });
    expect(
      validate1214(
        minimalInput({ capitalGains: [build({ withholders: [{}, {}, ...withholders(1)] })] }),
        OPTIONS,
      ),
    ).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('reports a fifth withholder as input.shape', () => {
    const input = minimalInput({
      capitalGains: [build({ withholders: [...withholders(4), { name: 'בנק' }] })],
    });
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({ ruleId: 'input.shape', path: 'capitalGains[0].withholders' }),
    ]);
  });
});

describe('mixed appendices (SPEC §3.3, §15 A-7)', () => {
  // Input order 64, 60, 63, 60: emitted 3060, 3060, 3063, 3064.
  const appendices = [
    reitAppendix(),
    securitiesAppendix({ amounts: { '012': 1 } }),
    section6Appendix(),
    securitiesAppendix({ amounts: { '012': 2 } }),
  ];
  const input = minimalInput({ capitalGains: appendices });

  it('groups the records by type ascending, numbers them per symbol, keeps the input index', () => {
    expect(
      capitalGainsRecords(input).map(r => [
        r.recordType,
        r.index,
        r.inputIndex,
        r.values.appendixNumber,
      ]),
    ).toEqual([
      ['3060', 0, 1, 1],
      ['3060', 1, 3, 2],
      ['3063', 0, 2, 1],
      ['3064', 0, 0, 1],
    ]);
    const lines = linesOf(input).filter(text =>
      isCapitalGainsRecordType(text.slice(4, 8) as '3060'),
    );
    expect(lines.map(text => [text.slice(4, 8), at(text, 137, 5)])).toEqual([
      ['3060', '60001'],
      ['3060', '60002'],
      ['3063', '63001'],
      ['3064', '64001'],
    ]);
    // Code 028 and 9999@145 count all of them.
    expect(mainOf(input).codes.get('028')).toBe(4);
    expect(at(linesOf(input).at(-1), 145, 2)).toBe('04');
  });

  it('writes no sequence for these types: the header ends with the losses carried forward', () => {
    for (const line of linesOf(input).slice(2, -1)) {
      const type = line.slice(4, 8) as '3060' | '3063' | '3064';
      const def = LAYOUT.records[type];
      const filler = def.fields.find(f => f.kind === 'filler');
      expect(filler).toBeDefined();
      expect(at(line, filler?.position ?? 0, filler?.length ?? 0)).toMatch(/^0+$/);
    }
  });
});

describe('end to end: appendices [64, 60, 63]', () => {
  const appendices = [
    reitAppendix({ withholders: [{ name: 'Leumi' }] }),
    securitiesAppendix(),
    section6Appendix({ foreignAsset: false }),
  ];
  const input = minimalInput({ capitalGains: appendices });

  it('reports an issue of the 3064 appendix at capitalGains[0], its input index', () => {
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'capitalGains[0].withholders[0].name',
        recordType: '3064',
        recordIndex: 0,
      }),
    ]);
  });

  it('reports an issue of the 3060 appendix at capitalGains[1] and of 3063 at capitalGains[2]', () => {
    const errors = validate1214(
      minimalInput({
        capitalGains: [
          reitAppendix(),
          securitiesAppendix({ lossesCarriedForward: 1.5 }),
          section6Appendix({ lossesCarriedForward: -1 }),
        ],
      }),
      OPTIONS,
    ).errors;
    expect(errors.map(issue => [issue.ruleId, issue.path, issue.recordType])).toEqual([
      ['field.integer', 'capitalGains[1].lossesCarriedForward', '3060'],
      ['field.negative', 'capitalGains[2].lossesCarriedForward', '3063'],
    ]);
  });

  it('generates 3060, 3063, 3064 and parses them back in file order', () => {
    const valid = minimalInput({
      capitalGains: [reitAppendix(), securitiesAppendix(), section6Appendix()],
    });
    const { text } = generate1214(valid, OPTIONS);
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual([
      securitiesAppendix(),
      section6Appendix(),
      reitAppendix(),
    ]);
  });
});
