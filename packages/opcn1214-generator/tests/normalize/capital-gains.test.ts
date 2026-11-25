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
import { fieldRules } from '../../src/validate/field-rules.js';
import {
  bettermentTaxAppendix,
  breakdownCountries,
  forcedVirtualCurrencyAppendix,
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
  section6Appendices,
  section6Appendix,
  securitiesAppendix,
  sharesAppendix,
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

  it('omits code 028 above 99, which the field.length notice reports at untransmittedCount', () => {
    const report = reportOf(
      minimalInput({
        capitalGains: section6Appendices(3),
        capitalGainsSummary: { untransmittedCount: 97, reasons: { lossOrNoGain: true } },
      }),
    );
    expect(report.records[0]?.codes.has('028')).toBe(false);
    expect(report.notices.map(notice => [notice.ruleId, notice.path, notice.value])).toEqual([
      ['field.length', 'capitalGainsSummary.untransmittedCount', 100],
    ]);
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

  it('raises main.capitalGains.flag for false with only untransmitted appendices, naming both counts', () => {
    const report = reportOf(
      minimalInput({
        declarations: { hasCapitalGainsAppendix: false },
        capitalGainsSummary: { untransmittedCount: 3, reasons: { lossOrNoGain: true } },
      }),
    );
    expect(report.notices).toEqual([
      expect.objectContaining({
        ruleId: 'main.capitalGains.flag',
        path: 'declarations.hasCapitalGainsAppendix',
        value: false,
        message: expect.stringMatching(/0 capital-gains appendices.*untransmittedCount 3/),
      }),
    ]);
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

describe('normalizeReport: record 3065 (no withholding, form 1322)', () => {
  const def = LAYOUT.records['3065'];

  it('has the securities header with a withholding status and the sequence, one position later', () => {
    const position = (key: string) => def.fields.find(f => f.key === key)?.position;
    expect(def.fields.filter(f => f.kind !== 'filler').map(f => f.key)).toEqual([
      'transactionSymbol',
      'appendixNumber',
      'foreignAsset',
      'soldToRelatedParty',
      'boughtFromRelatedParty',
      'gainFromInvestmentFund',
      'withholdingStatus',
      ...[0, 1, 2, 3].flatMap(i => [
        `withholders[${i}].name`,
        `withholders[${i}].branch`,
        `withholders[${i}].account`,
      ]),
      'lossesCarriedForward',
      'sequenceNumber',
    ]);
    // 3060 has its first withholder at 146; 3065 has the withholding status there.
    expect(LAYOUT.records['3060'].fields.find(f => f.key === 'withholders[0].name')?.position).toBe(
      146,
    );
    expect(position('withholdingStatus')).toBe(146);
    expect(position('withholders[0].name')).toBe(147);
    expect(position('sequenceNumber')).toBe(325);
  });

  it('maps the header, the withholders and the status code, with input paths', () => {
    const appendix = noWithholding1322Appendix();
    const [record] = capitalGainsRecords(minimalInput({ capitalGains: [appendix] }));
    expect(record?.recordType).toBe('3065');
    expect(record?.inputIndex).toBe(0);
    expect(record?.values).toEqual({
      transactionSymbol: 65,
      appendixNumber: 1,
      sequenceNumber: 1,
      foreignAsset: false,
      soldToRelatedParty: true,
      boughtFromRelatedParty: true,
      gainFromInvestmentFund: false,
      withholdingStatus: 2,
      'withholders[0].name': 'בנק הפועלים',
      'withholders[0].branch': '011',
      'withholders[0].account': '000123450',
      'withholders[1].name': 'בנק לאומי',
      'withholders[1].branch': '012',
      'withholders[1].account': '000123451',
      lossesCarriedForward: 6000,
    });
    expect(record?.paths).toEqual({
      transactionSymbol: '',
      appendixNumber: '',
      sequenceNumber: '',
      foreignAsset: 'capitalGains[0].foreignAsset',
      soldToRelatedParty: 'capitalGains[0].soldToRelatedParty',
      boughtFromRelatedParty: 'capitalGains[0].boughtFromRelatedParty',
      gainFromInvestmentFund: 'capitalGains[0].gainFromInvestmentFund',
      withholdingStatus: 'capitalGains[0].withholdingStatus',
      'withholders[0].name': 'capitalGains[0].withholders[0].name',
      'withholders[0].branch': 'capitalGains[0].withholders[0].branch',
      'withholders[0].account': 'capitalGains[0].withholders[0].account',
      'withholders[1].name': 'capitalGains[0].withholders[1].name',
      'withholders[1].branch': 'capitalGains[0].withholders[1].branch',
      'withholders[1].account': 'capitalGains[0].withholders[1].account',
      lossesCarriedForward: 'capitalGains[0].lossesCarriedForward',
      'code:012': 'capitalGains[0].amounts["012"]',
      'code:056': 'capitalGains[0].amounts["056"]',
    });
  });

  it('sets every non-filler header field with four withholders', () => {
    const report = reportOf(
      minimalInput({ capitalGains: [noWithholding1322Appendix({ withholders: withholders(4) })] }),
    );
    expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
  });

  it('writes the header at its layout positions', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [
          noWithholding1322Appendix({
            foreignAsset: true,
            soldToRelatedParty: false,
            boughtFromRelatedParty: true,
            gainFromInvestmentFund: false,
            withholdingStatus: 'notWithheldSecondHalf',
            withholders: [{}, { name: 'בנק', branch: '12', account: '345' }],
            lossesCarriedForward: 777,
          }),
        ],
      }),
      '3065',
    );
    expect(at(line, 137, 5)).toBe('65001');
    expect(at(line, 142, 4)).toBe('1212');
    expect(at(line, 146, 1)).toBe('3');
    // Slot 0 is empty; slot 1 at 189 (name, padded on the left), 219 (branch), 222 (account).
    expect(at(line, 147, 42)).toBe(' '.repeat(30) + '0'.repeat(12));
    expect(at(line, 189, 30)).toBe('בנק'.padStart(30, ' '));
    expect(at(line, 219, 3)).toBe('012');
    expect(at(line, 222, 9)).toBe('000000345');
    expect(at(line, 231, 84)).toBe((' '.repeat(30) + '0'.repeat(12)).repeat(2));
    expect(at(line, 315, 10)).toBe('0000000777');
    expect(at(line, 325, 2)).toBe('01');
    expect(at(line, 327, 834)).toMatch(/^0+$/);
    expect(at(line, 1161, 26)).toBe('0120000025000' + '0560000001250');
  });

  it('reports a withholder name that does not start with a Hebrew letter at its input path', () => {
    const input = minimalInput({
      capitalGains: [
        section6Appendix(),
        noWithholding1322Appendix({ withholders: [{}, { name: 'Bank Leumi' }] }),
      ],
    });
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'capitalGains[1].withholders[1].name',
        recordType: '3065',
        recordIndex: 0,
      }),
    ]);
  });

  it('reports a fifth withholder as input.shape', () => {
    const input = minimalInput({
      capitalGains: [
        noWithholding1322Appendix({ withholders: [...withholders(4), { name: 'בנק' }] }),
      ],
    });
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({ ruleId: 'input.shape', path: 'capitalGains[0].withholders' }),
    ]);
  });
});

describe('normalizeReport: record 3066 (no withholding, form 1326)', () => {
  const def = LAYOUT.records['3066'];

  it('has a short header: foreign asset, withholding status, losses and the sequence', () => {
    expect(
      def.fields.filter(f => f.kind !== 'filler').map(f => [f.key, f.position, f.length]),
    ).toEqual([
      ['transactionSymbol', 137, 2],
      ['appendixNumber', 139, 3],
      ['foreignAsset', 142, 1],
      ['withholdingStatus', 143, 1],
      ['lossesCarriedForward', 144, 10],
      ['sequenceNumber', 154, 2],
    ]);
  });

  it('maps the header and the status code, with input paths', () => {
    const [record] = capitalGainsRecords(
      minimalInput({ capitalGains: [noWithholding1326Appendix()] }),
    );
    expect(record?.recordType).toBe('3066');
    expect(record?.values).toEqual({
      transactionSymbol: 66,
      appendixNumber: 1,
      sequenceNumber: 1,
      foreignAsset: true,
      withholdingStatus: 3,
      lossesCarriedForward: 4000,
    });
    expect(record?.paths).toEqual({
      transactionSymbol: '',
      appendixNumber: '',
      sequenceNumber: '',
      foreignAsset: 'capitalGains[0].foreignAsset',
      withholdingStatus: 'capitalGains[0].withholdingStatus',
      lossesCarriedForward: 'capitalGains[0].lossesCarriedForward',
      'code:022': 'capitalGains[0].amounts["022"]',
      'code:056': 'capitalGains[0].amounts["056"]',
    });
  });

  it('sets every non-filler header field of record 3066', () => {
    const report = reportOf(minimalInput({ capitalGains: [noWithholding1326Appendix()] }));
    expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
  });

  it('writes the header at its layout positions', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [
          noWithholding1326Appendix({
            foreignAsset: false,
            withholdingStatus: 'notWithheldFirstHalf',
            lossesCarriedForward: 321,
          }),
        ],
      }),
      '3066',
    );
    expect(at(line, 137, 5)).toBe('66001');
    expect(at(line, 142, 1)).toBe('2');
    expect(at(line, 143, 1)).toBe('2');
    expect(at(line, 144, 10)).toBe('0000000321');
    expect(at(line, 154, 2)).toBe('01');
    expect(at(line, 156, 1005)).toMatch(/^0+$/);
    expect(at(line, 1161, 26)).toBe('0220000018000' + '0560000000900');
  });

  it('has no withholders member: one is input.shape', () => {
    const input = {
      ...minimalInput(),
      capitalGains: [{ ...noWithholding1326Appendix(), withholders: withholders(1) }],
    };
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({ ruleId: 'input.shape', path: 'capitalGains[0].withholders' }),
    ]);
  });
});

describe.each([
  ['3065', 146, noWithholding1322Appendix],
  ['3066', 143, noWithholding1326Appendix],
] as const)('withholdingStatus of record %s (SPEC §7.3, §15 A-18)', (type, position, build) => {
  const status = (
    withholdingStatus: 'notWithheldFirstHalf' | 'notWithheldSecondHalf' | undefined,
  ) =>
    at(
      linesOfType(minimalInput({ capitalGains: [build({ withholdingStatus })] }), type)[0],
      position,
      1,
    );

  it(`writes notWithheldFirstHalf → 2, notWithheldSecondHalf → 3, absent → 0 at ${position}`, () => {
    expect(status('notWithheldFirstHalf')).toBe('2');
    expect(status('notWithheldSecondHalf')).toBe('3');
    expect(status(undefined)).toBe('0');
  });

  it('reads the status back as its literal, and an absent one as absent', () => {
    for (const withholdingStatus of ['notWithheldFirstHalf', 'notWithheldSecondHalf'] as const) {
      const input = minimalInput({ capitalGains: [build({ withholdingStatus })] });
      const [appendix] = parse1214(generate1214(input, OPTIONS).text).report.capitalGains ?? [];
      expect(appendix).toMatchObject({ withholdingStatus });
    }
    const appendix = { ...build() };
    delete appendix.withholdingStatus;
    const input = minimalInput({ capitalGains: [appendix] });
    const [parsed] = parse1214(generate1214(input, OPTIONS).text).report.capitalGains ?? [];
    expect(parsed).toEqual(appendix);
    expect(parsed).not.toHaveProperty('withholdingStatus');
  });
});

describe('the "מספר בתל"ם" sequence across mixed appendices (SPEC §7.4, §15 A-7)', () => {
  // Input order 63, 65, 60, 66: emitted 3060, 3063, 3065, 3066.
  const input = minimalInput({
    capitalGains: [
      section6Appendix(),
      noWithholding1322Appendix(),
      securitiesAppendix(),
      noWithholding1326Appendix(),
    ],
  });

  it('numbers 3065 and 3066 by their emission position among all appendices', () => {
    expect(
      capitalGainsRecords(input).map(r => [
        r.recordType,
        r.inputIndex,
        r.values.appendixNumber,
        r.values.sequenceNumber,
      ]),
    ).toEqual([
      ['3060', 2, 1, undefined],
      ['3063', 0, 1, undefined],
      ['3065', 1, 1, 3],
      ['3066', 3, 1, 4],
    ]);
  });

  it('writes the sequence at 3065@325 and 3066@154, and keeps the input index in paths', () => {
    const lines = linesOf(input);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1020',
      '3060',
      '3063',
      '3065',
      '3066',
      '9999',
    ]);
    expect(at(lines[4], 325, 2)).toBe('03');
    expect(at(lines[5], 154, 2)).toBe('04');
    expect(at(lines.at(-1), 145, 2)).toBe('04');
    const errors = validate1214(
      minimalInput({
        capitalGains: [
          section6Appendix(),
          noWithholding1322Appendix({ lossesCarriedForward: -1 }),
          securitiesAppendix(),
          noWithholding1326Appendix({ lossesCarriedForward: 1.5 }),
        ],
      }),
      OPTIONS,
    ).errors;
    expect(errors.map(issue => [issue.ruleId, issue.path, issue.recordType])).toEqual([
      ['field.negative', 'capitalGains[1].lossesCarriedForward', '3065'],
      ['field.integer', 'capitalGains[3].lossesCarriedForward', '3066'],
    ]);
  });

  it('generates the four records and parses them back in file order', () => {
    const { text } = generate1214(input, OPTIONS);
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual([
      securitiesAppendix(),
      section6Appendix(),
      noWithholding1322Appendix(),
      noWithholding1326Appendix(),
    ]);
  });
});

/** The [ruleId, path, recordType] of every error of `input`. */
function errorsOf(input: Report1214Input): Array<[string, string, string | undefined]> {
  return validate1214(input, OPTIONS).errors.map(issue => [
    issue.ruleId,
    issue.path,
    issue.recordType,
  ]);
}

/**
 * The [ruleId, path] of the field-rule issues of the report of `input`, normalized without the
 * shape stage: an untyped caller's input that lacks a member the types require (SPEC §9.3).
 */
function fieldIssuesOf(input: unknown): Array<[string, string]> {
  return fieldRules(reportOf(input as Report1214Input)).map(issue => [issue.ruleId, issue.path]);
}

describe('normalizeReport: record 3027 (shares)', () => {
  const def = LAYOUT.records['3027'];

  it('has the asset header with three dates and the sequence at 255', () => {
    expect(
      def.fields.filter(f => f.kind !== 'filler').map(f => [f.key, f.position, f.length, f.kind]),
    ).toEqual([
      ['transactionSymbol', 137, 2, 'const'],
      ['appendixNumber', 139, 3, 'serial'],
      ['expropriation', 142, 1, 'yesNo'],
      ['assetDetails', 143, 50, 'hebrewText'],
      ['assetLocation', 193, 1, 'enum'],
      ['relatedParty', 194, 1, 'yesNo'],
      ['buyerName', 195, 30, 'text'],
      ['dates.code15', 225, 10, 'date'],
      ['dates.code20', 235, 10, 'date'],
      ['dates.code53', 245, 10, 'date'],
      ['sequenceNumber', 255, 2, 'serial'],
    ]);
  });

  it('maps the header, the dates as dates.<code> and the location code, with input paths', () => {
    const [record] = capitalGainsRecords(minimalInput({ capitalGains: [sharesAppendix()] }));
    expect(record?.recordType).toBe('3027');
    expect(record?.inputIndex).toBe(0);
    expect(record?.values).toEqual({
      transactionSymbol: 27,
      appendixNumber: 1,
      sequenceNumber: 1,
      expropriation: false,
      assetDetails: 'מניות חברה פרטית',
      assetLocation: 1,
      relatedParty: true,
      buyerName: 'קונה בע"מ',
      'dates.code15': '2024-03-15',
      'dates.code20': '2015-06-01',
      'dates.code53': '2010-01-31',
    });
    expect([...(record?.codes ?? [])]).toEqual([
      ['015', 90_000],
      ['018', 23],
      ['020', 1234.56],
      ['074', 5000],
    ]);
    expect(record?.paths).toEqual({
      transactionSymbol: '',
      appendixNumber: '',
      sequenceNumber: '',
      expropriation: 'capitalGains[0].expropriation',
      assetDetails: 'capitalGains[0].assetDetails',
      assetLocation: 'capitalGains[0].assetLocation',
      relatedParty: 'capitalGains[0].relatedParty',
      buyerName: 'capitalGains[0].buyerName',
      'dates.code15': 'capitalGains[0].dates.code15',
      'dates.code20': 'capitalGains[0].dates.code20',
      'dates.code53': 'capitalGains[0].dates.code53',
      'code:015': 'capitalGains[0].amounts["015"]',
      'code:018': 'capitalGains[0].amounts["018"]',
      'code:020': 'capitalGains[0].amounts["020"]',
      'code:074': 'capitalGains[0].amounts["074"]',
    });
  });

  it('sets every non-filler header field of record 3027', () => {
    const report = reportOf(minimalInput({ capitalGains: [sharesAppendix()] }));
    expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
  });

  it('writes the header at its layout positions, the dates as DD/MM/YYYY', () => {
    const [line] = linesOfType(minimalInput({ capitalGains: [sharesAppendix()] }), '3027');
    expect(at(line, 137, 5)).toBe('27001');
    expect(at(line, 142, 1)).toBe('2');
    expect(at(line, 143, 50)).toBe('מניות חברה פרטית'.padStart(50, ' '));
    expect(at(line, 193, 1)).toBe('1');
    expect(at(line, 194, 1)).toBe('1');
    expect(at(line, 195, 30)).toBe('קונה בע"מ'.padStart(30, ' '));
    expect(at(line, 225, 10)).toBe('15/03/2024');
    expect(at(line, 235, 10)).toBe('01/06/2015');
    expect(at(line, 245, 10)).toBe('31/01/2010');
    expect(at(line, 255, 2)).toBe('01');
    expect(at(line, 257, 904)).toMatch(/^0+$/);
  });

  it('writes codes 020/053/027 ×100 with agorot (1234.56 → 123456) and the rate 018 ×100', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [
          sharesAppendix({
            amounts: { '015': 7, '018': 23, '020': 1234.56, '027': 0.01, '053': 99 },
          }),
        ],
      }),
      '3027',
    );
    expect(at(line, 1161, 3 + 10 + 3 + 4 + 3 * (3 + 12) + 3 + 10)).toBe(
      '015' +
        '0000000007' +
        '018' +
        '2300' +
        '020' +
        '000000123456' +
        '027' +
        '000000000001' +
        '053' +
        '000000009900' +
        '074' +
        '0000005000',
    );
    const [rate50] = linesOfType(
      minimalInput({ capitalGains: [sharesAppendix({ amounts: { '015': 1, '018': 50 } })] }),
      '3027',
    );
    expect(at(rate50, 1174, 7)).toBe('0185000');
  });

  it('reports code 018 outside {23, 50} as field.enum and a third decimal as field.decimals', () => {
    expect(
      errorsOf(
        minimalInput({
          capitalGains: [
            section6Appendix(),
            sharesAppendix({ amounts: { '018': 30, '053': 1.234 } }),
          ],
        }),
      ),
    ).toEqual([
      ['field.enum', 'capitalGains[1].amounts["018"]', '3027'],
      ['field.decimals', 'capitalGains[1].amounts["053"]', '3027'],
    ]);
  });

  it('writes assetLocation abroad → 1, israel → 2, absent → 0', () => {
    const location = (assetLocation: 'abroad' | 'israel' | undefined) =>
      at(
        linesOfType(minimalInput({ capitalGains: [sharesAppendix({ assetLocation })] }), '3027')[0],
        193,
        1,
      );
    expect(location('abroad')).toBe('1');
    expect(location('israel')).toBe('2');
    expect(location(undefined)).toBe('0');
  });

  it('accepts an appendix without dates or other members: the date fields are blank', () => {
    const input = minimalInput({ capitalGains: [{ symbol: 27, amounts: { '015': 1 } }] });
    expect(validate1214(input, OPTIONS)).toEqual({ valid: true, errors: [], warnings: [] });
    const [line] = linesOfType(input, '3027');
    expect(at(line, 142, 1)).toBe('0');
    expect(at(line, 225, 30)).toBe(' '.repeat(30));
    expect(at(line, 255, 2)).toBe('01');
    const partial = minimalInput({
      capitalGains: [
        sharesAppendix({ dates: { code15: undefined, code20: undefined, code53: '2020-02-29' } }),
      ],
    });
    const [partialLine] = linesOfType(partial, '3027');
    expect(at(partialLine, 225, 30)).toBe(' '.repeat(20) + '29/02/2020');
  });

  it('reports a date that is not a real calendar date at capitalGains[i].dates.<code>', () => {
    expect(
      errorsOf(
        minimalInput({ capitalGains: [sharesAppendix({ dates: { code20: '2023-02-29' } })] }),
      ),
    ).toEqual([['field.date', 'capitalGains[0].dates.code20', '3027']]);
  });

  it('takes a buyer name that does not start with a Hebrew letter (kind text)', () => {
    expect(
      errorsOf(minimalInput({ capitalGains: [sharesAppendix({ buyerName: 'Buyer Ltd' })] })),
    ).toEqual([]);
  });
});

describe.each([
  ['3050', 'betterment tax', bettermentTaxAppendix, 193, 203],
  ['3054', 'oil partnership', oilPartnershipAppendix, 192, 202],
] as const)(
  'normalizeReport: record %s (%s)',
  (type, _name, build, purchaseDatePosition, code15Position) => {
    const def = LAYOUT.records[type];
    const symbol = Number(type.slice(2));

    it('requires the purchase date and the code-15 date and has no sequence field', () => {
      const keys = def.fields.filter(f => f.kind !== 'filler').map(f => f.key);
      expect(keys).not.toContain('sequenceNumber');
      expect(
        def.fields
          .filter(f => f.key === 'purchaseDate' || f.key === 'dates.code15')
          .map(f => [f.key, f.position, f.required, f.kind]),
      ).toEqual([
        ['purchaseDate', purchaseDatePosition, 'yes', 'date'],
        ['dates.code15', code15Position, 'yes', 'date'],
      ]);
    });

    it('maps the header with input paths', () => {
      const appendix = build();
      const [record] = capitalGainsRecords(minimalInput({ capitalGains: [appendix] }));
      expect(record?.recordType).toBe(type);
      expect(record?.values).toEqual({
        transactionSymbol: symbol,
        appendixNumber: 1,
        ...('expropriation' in appendix ? { expropriation: appendix.expropriation } : {}),
        assetDetails: appendix.assetDetails,
        purchaseDate: appendix.purchaseDate,
        'dates.code15': appendix.dates.code15,
      });
      expect(record?.paths).toMatchObject({
        transactionSymbol: '',
        appendixNumber: '',
        assetDetails: 'capitalGains[0].assetDetails',
        purchaseDate: 'capitalGains[0].purchaseDate',
        'dates.code15': 'capitalGains[0].dates.code15',
        'code:015': 'capitalGains[0].amounts["015"]',
      });
    });

    it(`sets every non-filler header field of record ${type}`, () => {
      const report = reportOf(minimalInput({ capitalGains: [build()] }));
      expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
    });

    it('writes the header at its layout positions', () => {
      const appendix = build({ purchaseDate: '2001-02-03', dates: { code15: '2024-11-30' } });
      const [line] = linesOfType(minimalInput({ capitalGains: [appendix] }), type);
      expect(at(line, 137, 5)).toBe(`${symbol}001`);
      expect(at(line, purchaseDatePosition, 10)).toBe('03/02/2001');
      expect(at(line, code15Position, 10)).toBe('30/11/2024');
      expect(at(line, purchaseDatePosition - 50, 50)).toBe(
        (appendix.assetDetails ?? '').padStart(50, ' '),
      );
      expect(at(line, code15Position + 10, 1160 - code15Position - 9)).toMatch(/^0+$/);
    });

    it('reports an absent purchase date or code-15 date: input.shape for typed input', () => {
      const appendix: Record<string, unknown> = { ...build() };
      delete appendix['purchaseDate'];
      const input = { ...minimalInput(), capitalGains: [appendix, { ...build(), dates: {} }] };
      expect(validate1214(input, OPTIONS).errors.map(issue => [issue.ruleId, issue.path])).toEqual([
        ['input.shape', 'capitalGains[0].purchaseDate'],
        ['input.shape', 'capitalGains[1].dates.code15'],
      ]);
    });

    it('reports them as field.required at capitalGains[i].purchaseDate / .dates.code15', () => {
      const withoutPurchaseDate: Record<string, unknown> = { ...build() };
      delete withoutPurchaseDate['purchaseDate'];
      const withoutDates: Record<string, unknown> = { ...build() };
      delete withoutDates['dates'];
      expect(
        fieldIssuesOf({
          ...minimalInput(),
          capitalGains: [section6Appendix(), withoutDates, withoutPurchaseDate],
        }),
      ).toEqual([
        ['field.required', 'capitalGains[1].dates.code15'],
        ['field.required', 'capitalGains[2].purchaseDate'],
      ]);
    });
  },
);

describe('record 3050 codes', () => {
  it('accepts code 014 = 10 or 20 and reports any other value as field.enum', () => {
    expect(
      errorsOf(minimalInput({ capitalGains: [bettermentTaxAppendix({ amounts: { '014': 20 } })] })),
    ).toEqual([]);
    expect(
      errorsOf(minimalInput({ capitalGains: [bettermentTaxAppendix({ amounts: { '014': 15 } })] })),
    ).toEqual([['field.enum', 'capitalGains[0].amounts["014"]', '3050']]);
  });

  it('writes 014, then 015, 016 and the rate 018 ×100 in ascending code order', () => {
    const [line] = linesOfType(minimalInput({ capitalGains: [bettermentTaxAppendix()] }), '3050');
    expect(at(line, 1161, 5 + 13 + 13 + 7)).toBe(
      '01410' + '0150001200000' + '0160000700000' + '0185000',
    );
  });

  it('reports code 018 outside {23, 50} as field.enum (D-6)', () => {
    expect(
      errorsOf(minimalInput({ capitalGains: [bettermentTaxAppendix({ amounts: { '018': 25 } })] })),
    ).toEqual([['field.enum', 'capitalGains[0].amounts["018"]', '3050']]);
  });

  it('omits code 016 = 0 (not zeroAllowed in 3050)', () => {
    const report = reportOf(
      minimalInput({ capitalGains: [bettermentTaxAppendix({ amounts: { '016': 0 } })] }),
    );
    expect(report.omittedZeroCodes).toEqual([{ record: '3050', recordIndex: 0, code: '016' }]);
  });
});

describe('record 3054 codes', () => {
  it('writes code 016 = 0 (zeroAllowed, SPEC §4.5)', () => {
    const input = minimalInput({
      capitalGains: [oilPartnershipAppendix({ amounts: { '015': 0, '016': 0 } })],
    });
    const report = reportOf(input);
    expect(report.omittedZeroCodes).toEqual([{ record: '3054', recordIndex: 0, code: '015' }]);
    const [line] = linesOfType(input, '3054');
    expect(at(line, 1161, 14)).toBe('0160000000000' + '0');
    expect(validate1214(input, OPTIONS).errors).toEqual([]);
  });
});

describe('normalizeReport: record 3051 (forced virtual-currency transaction)', () => {
  const def = LAYOUT.records['3051'];

  it('has the asset header, the sequence at 234 and two wallet addresses at 236 and 386', () => {
    expect(
      def.fields
        .filter(f => f.kind !== 'filler')
        .map(f => [f.key, f.position, f.length, f.kind, f.required]),
    ).toEqual([
      ['transactionSymbol', 137, 2, 'const', 'yes'],
      ['appendixNumber', 139, 3, 'serial', 'yes'],
      ['assetDetails', 142, 50, 'hebrewText', 'no'],
      ['assetLocation', 192, 1, 'enum', 'no'],
      ['relatedParty', 193, 1, 'yesNo', 'no'],
      ['buyerName', 194, 30, 'hebrewText', 'no'],
      ['dates.code15', 224, 10, 'date', 'yes'],
      ['sequenceNumber', 234, 2, 'serial', 'yes'],
      ['walletAddresses[0]', 236, 150, 'text', 'no'],
      ['walletAddresses[1]', 386, 150, 'text', 'no'],
    ]);
  });

  it('maps the header, walletAddresses[i] to keys walletAddresses[i], with input paths', () => {
    const [record] = capitalGainsRecords(
      minimalInput({ capitalGains: [forcedVirtualCurrencyAppendix()] }),
    );
    expect(record?.recordType).toBe('3051');
    expect(record?.values).toEqual({
      transactionSymbol: 51,
      appendixNumber: 1,
      sequenceNumber: 1,
      assetDetails: 'ביטקוין',
      assetLocation: 2,
      relatedParty: false,
      buyerName: 'בורסת מטבעות',
      'dates.code15': '2024-12-31',
      'walletAddresses[0]': 'bc1qwalletaddressone',
      'walletAddresses[1]': 'bc1qwalletaddresstwo',
    });
    expect([...(record?.codes ?? [])]).toEqual([
      ['015', 80_000],
      ['016', 30_000],
      ['071', 1],
    ]);
    expect(record?.paths).toEqual({
      transactionSymbol: '',
      appendixNumber: '',
      sequenceNumber: '',
      assetDetails: 'capitalGains[0].assetDetails',
      assetLocation: 'capitalGains[0].assetLocation',
      relatedParty: 'capitalGains[0].relatedParty',
      buyerName: 'capitalGains[0].buyerName',
      'dates.code15': 'capitalGains[0].dates.code15',
      'walletAddresses[0]': 'capitalGains[0].walletAddresses[0]',
      'walletAddresses[1]': 'capitalGains[0].walletAddresses[1]',
      'code:015': 'capitalGains[0].amounts["015"]',
      'code:016': 'capitalGains[0].amounts["016"]',
      'code:071': 'capitalGains[0].amounts["071"]',
    });
  });

  it('sets every non-filler header field of record 3051', () => {
    const report = reportOf(minimalInput({ capitalGains: [forcedVirtualCurrencyAppendix()] }));
    expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
  });

  it('writes the header at its layout positions, the wallet addresses padded to 150', () => {
    const [line] = linesOfType(
      minimalInput({ capitalGains: [forcedVirtualCurrencyAppendix()] }),
      '3051',
    );
    expect(at(line, 137, 5)).toBe('51001');
    expect(at(line, 142, 50)).toBe('ביטקוין'.padStart(50, ' '));
    expect(at(line, 192, 2)).toBe('22');
    expect(at(line, 194, 30)).toBe('בורסת מטבעות'.padStart(30, ' '));
    expect(at(line, 224, 10)).toBe('31/12/2024');
    expect(at(line, 234, 2)).toBe('01');
    expect(at(line, 236, 150)).toBe('bc1qwalletaddressone'.padStart(150, ' '));
    expect(at(line, 386, 150)).toBe('bc1qwalletaddresstwo'.padStart(150, ' '));
    expect(at(line, 536, 625)).toMatch(/^0+$/);
    expect(at(line, 1161, 13 + 13 + 4)).toBe('0150000080000' + '0160000030000' + '0711');
  });

  it('writes one wallet address in the first slot and leaves the second blank', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [forcedVirtualCurrencyAppendix({ walletAddresses: ['0xabc'] })],
      }),
      '3051',
    );
    expect(at(line, 236, 150)).toBe('0xabc'.padStart(150, ' '));
    expect(at(line, 386, 150)).toBe(' '.repeat(150));
  });

  it('requires codes 071 and 016 (field.required; 0 counts as absent) and 071 = 1', () => {
    expect(
      errorsOf(
        minimalInput({
          capitalGains: [
            sharesAppendix(),
            forcedVirtualCurrencyAppendix({ amounts: { '071': undefined, '016': 0 } }),
          ],
        }),
      ),
    ).toEqual([
      ['field.required', 'capitalGains[1].amounts["016"]', '3051'],
      ['field.required', 'capitalGains[1].amounts["071"]', '3051'],
    ]);
    expect(
      errorsOf(
        minimalInput({ capitalGains: [forcedVirtualCurrencyAppendix({ amounts: { '071': 2 } })] }),
      ),
    ).toEqual([['field.enum', 'capitalGains[0].amounts["071"]', '3051']]);
  });

  it('reports an absent code-15 date: input.shape for typed input, field.required in the model', () => {
    const input = {
      ...minimalInput(),
      capitalGains: [{ ...forcedVirtualCurrencyAppendix(), dates: {} }],
    };
    expect(validate1214(input, OPTIONS).errors.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['input.shape', 'capitalGains[0].dates.code15'],
    ]);
    expect(fieldIssuesOf(input)).toEqual([['field.required', 'capitalGains[0].dates.code15']]);
  });

  it('reports a wallet address over 150 characters at its slot and a third one as input.shape', () => {
    expect(
      errorsOf(
        minimalInput({
          capitalGains: [
            forcedVirtualCurrencyAppendix({ walletAddresses: ['a', 'b'.repeat(151)] }),
          ],
        }),
      ),
    ).toEqual([['field.length', 'capitalGains[0].walletAddresses[1]', '3051']]);
    expect(
      errorsOf(
        minimalInput({
          capitalGains: [forcedVirtualCurrencyAppendix({ walletAddresses: ['a'.repeat(150)] })],
        }),
      ),
    ).toEqual([]);
    const input = {
      ...minimalInput(),
      capitalGains: [{ ...forcedVirtualCurrencyAppendix(), walletAddresses: ['a', 'b', 'c'] }],
    };
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({ ruleId: 'input.shape', path: 'capitalGains[0].walletAddresses' }),
    ]);
  });

  it('reports a buyer name that does not start with a Hebrew letter (kind hebrewText)', () => {
    expect(
      errorsOf(
        minimalInput({ capitalGains: [forcedVirtualCurrencyAppendix({ buyerName: 'Exchange' })] }),
      ),
    ).toEqual([['field.hebrewFirstLetter', 'capitalGains[0].buyerName', '3051']]);
  });
});

describe('the "מספר בתל"ם" sequence with asset appendices (SPEC §7.4, §15 A-7)', () => {
  // Input order 51, 63, 27, 65, 50, 54, 27: emitted 3027, 3027, 3050, 3051, 3054, 3063, 3065.
  const appendices = [
    forcedVirtualCurrencyAppendix(),
    section6Appendix(),
    sharesAppendix(),
    noWithholding1322Appendix(),
    bettermentTaxAppendix(),
    oilPartnershipAppendix(),
    sharesAppendix({ assetLocation: 'israel' }),
  ];
  const input = minimalInput({ capitalGains: appendices });

  it('numbers 3027, 3051 and 3065 by their emission position among all appendices', () => {
    expect(
      capitalGainsRecords(input).map(r => [
        r.recordType,
        r.inputIndex,
        r.values.appendixNumber,
        r.values.sequenceNumber,
      ]),
    ).toEqual([
      ['3027', 2, 1, 1],
      ['3027', 6, 2, 2],
      ['3050', 4, 1, undefined],
      ['3051', 0, 1, 4],
      ['3054', 5, 1, undefined],
      ['3063', 1, 1, undefined],
      ['3065', 3, 1, 7],
    ]);
  });

  it('writes the sequences at 3027@255, 3051@234 and 3065@325', () => {
    const lines = linesOf(input);
    expect(lines.map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1020',
      '3027',
      '3027',
      '3050',
      '3051',
      '3054',
      '3063',
      '3065',
      '9999',
    ]);
    expect([at(lines[2], 255, 2), at(lines[3], 255, 2)]).toEqual(['01', '02']);
    expect(at(lines[5], 234, 2)).toBe('04');
    expect(at(lines[8], 325, 2)).toBe('07');
    expect(at(lines.at(-1), 145, 2)).toBe('07');
  });

  it('generates the seven records and parses them back in file order', () => {
    expect(validate1214(input, OPTIONS)).toEqual({ valid: true, errors: [], warnings: [] });
    const parsed = parse1214(generate1214(input, OPTIONS).text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual([
      appendices[2],
      appendices[6],
      appendices[4],
      appendices[0],
      appendices[5],
      appendices[1],
      appendices[3],
    ]);
  });
});

describe('normalizeReport: record 3077 (other transactions)', () => {
  const def = LAYOUT.records['3077'];

  it('has the asset header, five improvement slots, a replacement asset, the sequence and two wallets', () => {
    expect(
      def.fields
        .filter(f => f.kind !== 'filler')
        .map(f => [f.key, f.position, f.length, f.kind, f.required]),
    ).toEqual([
      ['transactionSymbol', 137, 2, 'const', 'yes'],
      ['appendixNumber', 139, 3, 'serial', 'yes'],
      ['expropriation', 142, 1, 'yesNo', 'no'],
      ['assetDetails', 143, 50, 'text', 'no'],
      ['assetLocation', 193, 1, 'enum', 'no'],
      ['relatedParty', 194, 1, 'yesNo', 'no'],
      ['buyerName', 195, 30, 'text', 'no'],
      ['dates.code15', 225, 10, 'date', 'yes'],
      ['dates.code20', 235, 10, 'date', 'yes'],
      ['improvementCount', 245, 2, 'count', 'no'],
      ...[0, 1, 2, 3, 4].flatMap(slot => [
        [`improvements[${slot}].expense`, 247 + 34 * slot, 12, 'amountX100', 'no'],
        [`improvements[${slot}].accumulatedDepreciation`, 259 + 34 * slot, 12, 'amountX100', 'no'],
        [`improvements[${slot}].date`, 271 + 34 * slot, 10, 'date', 'yes'],
      ]),
      ['replacementAsset.details', 417, 50, 'text', 'no'],
      ['replacementAsset.purchaseDate', 467, 10, 'date', 'no'],
      ['replacementAsset.price', 477, 10, 'amount', 'no'],
      ['sequenceNumber', 487, 2, 'serial', 'yes'],
      ['walletAddresses[0]', 489, 150, 'text', 'no'],
      ['walletAddresses[1]', 639, 150, 'text', 'no'],
    ]);
    expect(def.codes.filter(code => code.derived).map(code => code.code)).toEqual([
      '501',
      '502',
      '503',
      '504',
      '505',
    ]);
  });

  it('maps improvements[i] to keys improvements[i].*, code50Amount to code 50(i+1), 245 to the count', () => {
    const [section6, other] = capitalGainsRecords(
      minimalInput({ capitalGains: [section6Appendix(), otherTransactionsAppendix()] }),
    );
    expect(section6?.recordType).toBe('3063');
    expect(other?.recordType).toBe('3077');
    expect(other?.values).toEqual({
      transactionSymbol: 77,
      appendixNumber: 1,
      sequenceNumber: 2,
      expropriation: false,
      assetDetails: 'מבנה תעשייה',
      assetLocation: 2,
      relatedParty: true,
      buyerName: 'רוכש נכסים בע"מ',
      'dates.code15': '2024-07-01',
      'dates.code20': '2009-02-01',
      improvementCount: 2,
      'improvements[0].expense': 10_000.25,
      'improvements[0].accumulatedDepreciation': 1000,
      'improvements[0].date': '2010-01-15',
      'improvements[1].expense': 20_000.25,
      'improvements[1].accumulatedDepreciation': 2000,
      'improvements[1].date': '2011-02-15',
      'replacementAsset.details': 'מבנה חלופי',
      'replacementAsset.purchaseDate': '2024-09-01',
      'replacementAsset.price': 2_000_000,
      'walletAddresses[0]': 'bc1qotherwalletone',
    });
    expect([...(other?.codes ?? [])]).toEqual([
      ['015', 3_000_000],
      ['020', 1_500_000.5],
      ['071', 1],
      ['501', 9000.5],
      ['502', 18_000.5],
    ]);
    expect(other?.paths).toEqual({
      transactionSymbol: '',
      appendixNumber: '',
      sequenceNumber: '',
      improvementCount: '',
      expropriation: 'capitalGains[1].expropriation',
      assetDetails: 'capitalGains[1].assetDetails',
      assetLocation: 'capitalGains[1].assetLocation',
      relatedParty: 'capitalGains[1].relatedParty',
      buyerName: 'capitalGains[1].buyerName',
      'dates.code15': 'capitalGains[1].dates.code15',
      'dates.code20': 'capitalGains[1].dates.code20',
      'improvements[0].expense': 'capitalGains[1].improvements[0].expense',
      'improvements[0].accumulatedDepreciation':
        'capitalGains[1].improvements[0].accumulatedDepreciation',
      'improvements[0].date': 'capitalGains[1].improvements[0].date',
      'improvements[1].expense': 'capitalGains[1].improvements[1].expense',
      'improvements[1].accumulatedDepreciation':
        'capitalGains[1].improvements[1].accumulatedDepreciation',
      'improvements[1].date': 'capitalGains[1].improvements[1].date',
      'replacementAsset.details': 'capitalGains[1].replacementAsset.details',
      'replacementAsset.purchaseDate': 'capitalGains[1].replacementAsset.purchaseDate',
      'replacementAsset.price': 'capitalGains[1].replacementAsset.price',
      'walletAddresses[0]': 'capitalGains[1].walletAddresses[0]',
      'code:015': 'capitalGains[1].amounts["015"]',
      'code:020': 'capitalGains[1].amounts["020"]',
      'code:071': 'capitalGains[1].amounts["071"]',
      'code:501': 'capitalGains[1].improvements[0].code50Amount',
      'code:502': 'capitalGains[1].improvements[1].code50Amount',
    });
  });

  it('sets every non-filler header field of record 3077 with five improvements and two wallets', () => {
    const report = reportOf(
      minimalInput({
        capitalGains: [
          otherTransactionsAppendix({
            improvements: improvements(5),
            walletAddresses: ['0x1', '0x2'],
          }),
        ],
      }),
    );
    expect(unmappedHeaderKeys(def, report.records)).toEqual([]);
  });

  it('writes the header at its layout positions: ×100 improvement amounts, dates DD/MM/YYYY', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [
          otherTransactionsAppendix({
            improvements: improvements(5),
            walletAddresses: ['0x1', '0x2'],
          }),
        ],
      }),
      '3077',
    );
    expect(at(line, 137, 5)).toBe('77001');
    expect(at(line, 142, 1)).toBe('2');
    expect(at(line, 143, 50)).toBe('מבנה תעשייה'.padStart(50, ' '));
    expect(at(line, 193, 2)).toBe('21');
    expect(at(line, 195, 30)).toBe('רוכש נכסים בע"מ'.padStart(30, ' '));
    expect(at(line, 225, 10)).toBe('01/07/2024');
    expect(at(line, 235, 10)).toBe('01/02/2009');
    expect(at(line, 245, 2)).toBe('05');
    expect(at(line, 247, 12)).toBe('000001000025');
    expect(at(line, 259, 12)).toBe('000000100000');
    expect(at(line, 271, 10)).toBe('15/01/2010');
    expect(at(line, 383, 12)).toBe('000005000025');
    expect(at(line, 395, 12)).toBe('000000500000');
    expect(at(line, 407, 10)).toBe('15/05/2014');
    expect(at(line, 417, 50)).toBe('מבנה חלופי'.padStart(50, ' '));
    expect(at(line, 467, 10)).toBe('01/09/2024');
    expect(at(line, 477, 10)).toBe('0002000000');
    expect(at(line, 487, 2)).toBe('01');
    expect(at(line, 489, 150)).toBe('0x1'.padStart(150, ' '));
    expect(at(line, 639, 150)).toBe('0x2'.padStart(150, ' '));
    expect(at(line, 789, 372)).toMatch(/^0+$/);
  });

  it('writes codes 501–505 ×100 after the input codes, in ascending code order', () => {
    const [line] = linesOfType(
      minimalInput({
        capitalGains: [
          otherTransactionsAppendix({ improvements: improvements(5), amounts: { '092': 7 } }),
        ],
      }),
      '3077',
    );
    expect(at(line, 1161, 13 + 15 + 4 + 4 + 5 * 15)).toBe(
      '0150003000000' +
        '020000150000050' +
        '0711' +
        '0927' +
        '501000000900050' +
        '502000001800050' +
        '503000002700050' +
        '504000003600050' +
        '505000004500050',
    );
  });

  it('writes 245 = 00 and blank slots without improvements, and reads none back', () => {
    const appendix = otherTransactionsAppendix({ improvements: undefined });
    const input = minimalInput({ capitalGains: [appendix] });
    const [record] = capitalGainsRecords(input);
    expect(record?.values).not.toHaveProperty('improvementCount');
    const [line] = linesOfType(input, '3077');
    expect(at(line, 245, 2)).toBe('00');
    expect(at(line, 247, 24)).toMatch(/^0+$/);
    expect(at(line, 271, 10)).toBe(' '.repeat(10));
    const parsed = parse1214(generate1214(input, OPTIONS).text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains?.[0]).not.toHaveProperty('improvements');
  });

  it('raises no field.required for the empty slots 2–5 of a 3077 with one improvement', () => {
    const input = minimalInput({
      capitalGains: [otherTransactionsAppendix({ improvements: improvements(1) })],
    });
    expect(validate1214(input, OPTIONS)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('raises cg.improvements.max as a notice for a sixth improvement and writes the first five', () => {
    const input = minimalInput({
      capitalGains: [
        section6Appendix(),
        otherTransactionsAppendix({ improvements: improvements(6) }),
      ],
    });
    const report = reportOf(input);
    expect(report.notices).toEqual([
      expect.objectContaining({
        ruleId: 'cg.improvements.max',
        severity: 'error',
        path: 'capitalGains[1].improvements[5]',
        recordType: '3077',
        recordIndex: 0,
      }),
    ]);
    const record = report.records.find(r => r.recordType === '3077');
    expect(record?.values['improvements[4].date']).toBe('2014-05-15');
    expect(
      Object.keys(record?.values ?? {}).filter(key => key.startsWith('improvements[5]')),
    ).toEqual([]);
    expect([...(record?.codes.keys() ?? [])].filter(code => code.startsWith('50'))).toEqual([
      '501',
      '502',
      '503',
      '504',
      '505',
    ]);
    expect(errorsOf(input)).toEqual([
      ['cg.improvements.max', 'capitalGains[1].improvements[5]', '3077'],
    ]);
  });

  it('accepts code 092 as a single digit 0–9 (SPEC §15 A-11)', () => {
    for (const value of [1, 9]) {
      expect(
        errorsOf(
          minimalInput({
            capitalGains: [otherTransactionsAppendix({ amounts: { '092': value } })],
          }),
        ),
      ).toEqual([]);
    }
    expect(
      errorsOf(
        minimalInput({ capitalGains: [otherTransactionsAppendix({ amounts: { '092': 10 } })] }),
      ),
    ).toEqual([['field.length', 'capitalGains[0].amounts["092"]', '3077']]);
  });

  it('requires dates.code15 and dates.code20: input.shape for typed input, field.required in the model', () => {
    const input = {
      ...minimalInput(),
      capitalGains: [{ ...otherTransactionsAppendix(), dates: {} }],
    };
    expect(validate1214(input, OPTIONS).errors.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['input.shape', 'capitalGains[0].dates.code15'],
      ['input.shape', 'capitalGains[0].dates.code20'],
    ]);
    expect(fieldIssuesOf(input)).toEqual([
      ['field.required', 'capitalGains[0].dates.code15'],
      ['field.required', 'capitalGains[0].dates.code20'],
    ]);
  });

  it('reports an improvement without a date: input.shape for typed input, field.required in the model', () => {
    const { date: _date, ...undated } = improvements(2)[1]!;
    const input = {
      ...minimalInput(),
      capitalGains: [
        { ...otherTransactionsAppendix(), improvements: [improvements(1)[0], undated] },
      ],
    };
    expect(validate1214(input, OPTIONS).errors.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['input.shape', 'capitalGains[0].improvements[1].date'],
    ]);
    expect(fieldIssuesOf(input)).toEqual([
      ['field.required', 'capitalGains[0].improvements[1].date'],
    ]);
  });

  it('reports a problem of an improvement or of its code-50 amount at the improvement', () => {
    expect(
      errorsOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({
              improvements: [
                improvements(1)[0]!,
                { expense: 1.234, date: '2020-02-30', code50Amount: -1 },
              ],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['field.decimals', 'capitalGains[0].improvements[1].expense', '3077'],
      ['field.date', 'capitalGains[0].improvements[1].date', '3077'],
      ['field.negative', 'capitalGains[0].improvements[1].code50Amount', '3077'],
    ]);
  });

  it('reports a derived code 501–505 in amounts as input.derivedCode naming the improvement', () => {
    const input = {
      ...minimalInput(),
      capitalGains: [
        section6Appendix(),
        { ...otherTransactionsAppendix(), amounts: { '015': 1, '501': 5, '505': 6 } },
      ],
    };
    const { errors } = validate1214(input, OPTIONS);
    expect(errors.map(issue => [issue.ruleId, issue.path, issue.recordType])).toEqual([
      ['input.derivedCode', 'capitalGains[1].amounts["501"]', '3077'],
      ['input.derivedCode', 'capitalGains[1].amounts["505"]', '3077'],
    ]);
    expect(errors[0]?.message).toContain('capitalGains[1].improvements[0].code50Amount');
    expect(errors[1]?.message).toContain('capitalGains[1].improvements[4].code50Amount');
  });

  it('reports a wallet address over 150 characters at its slot and a third one as input.shape', () => {
    expect(
      errorsOf(
        minimalInput({
          capitalGains: [otherTransactionsAppendix({ walletAddresses: ['a', 'b'.repeat(151)] })],
        }),
      ),
    ).toEqual([['field.length', 'capitalGains[0].walletAddresses[1]', '3077']]);
    const input = {
      ...minimalInput(),
      capitalGains: [{ ...otherTransactionsAppendix(), walletAddresses: ['a', 'b', 'c'] }],
    };
    expect(validate1214(input, OPTIONS).errors).toEqual([
      expect.objectContaining({ ruleId: 'input.shape', path: 'capitalGains[0].walletAddresses' }),
    ]);
  });

  it('generates a 3077 with every member and parses it back', () => {
    const appendix = otherTransactionsAppendix({
      improvements: improvements(5),
      walletAddresses: ['0x1', '0x2'],
      amounts: { '092': 3 },
    });
    const input = minimalInput({ capitalGains: [appendix] });
    expect(validate1214(input, OPTIONS)).toEqual({ valid: true, errors: [], warnings: [] });
    const parsed = parse1214(generate1214(input, OPTIONS).text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual([appendix]);
  });
});

describe('the "מספר בתל"ם" sequence with a 3077 appendix (SPEC §7.4, §15 A-7)', () => {
  // Input order 77, 27, 66, 77: emitted 3027, 3066, 3077, 3077.
  const appendices = [
    otherTransactionsAppendix(),
    sharesAppendix(),
    noWithholding1326Appendix(),
    otherTransactionsAppendix({ assetLocation: 'abroad', improvements: improvements(1) }),
  ];
  const input = minimalInput({ capitalGains: appendices });

  it('numbers the 3077 appendices per symbol and writes their sequence at 487', () => {
    expect(
      capitalGainsRecords(input).map(r => [
        r.recordType,
        r.inputIndex,
        r.values.appendixNumber,
        r.values.sequenceNumber,
      ]),
    ).toEqual([
      ['3027', 1, 1, 1],
      ['3066', 2, 1, 2],
      ['3077', 0, 1, 3],
      ['3077', 3, 2, 4],
    ]);
    const lines = linesOfType(input, '3077');
    expect(lines.map(line => [at(line, 137, 5), at(line, 487, 2)])).toEqual([
      ['77001', '03'],
      ['77002', '04'],
    ]);
  });

  it('generates the four records and parses them back in file order', () => {
    expect(validate1214(input, OPTIONS)).toEqual({ valid: true, errors: [], warnings: [] });
    const parsed = parse1214(generate1214(input, OPTIONS).text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.capitalGains).toEqual([
      appendices[1],
      appendices[2],
      appendices[0],
      appendices[3],
    ]);
  });
});
