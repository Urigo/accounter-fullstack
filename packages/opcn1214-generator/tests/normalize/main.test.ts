import { renderReport } from '../../src/file/assemble.js';
import { getLayout } from '../../src/layout/registry.js';
import type { PhonePrefix, Report1214Input } from '../../src/model/input.js';
import type { NormalizedRecord } from '../../src/model/normalized.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { todayInJerusalem } from '../../src/normalize/today.js';
import { fullDeclarationsInput, fullMainInput, minimalInput } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const TODAY = '2024-06-30';
const OPTIONS = { today: () => TODAY };

function mainRecord(input = minimalInput(), options = OPTIONS): NormalizedRecord {
  const record = normalizeReport(input, LAYOUT, options).records[0];
  if (record?.recordType !== '1000') {
    throw new Error('expected record 1000 first');
  }
  return record;
}

/** The record 1000 line of `input`. */
function mainLine(input: Report1214Input): string {
  const line = renderReport(normalizeReport(input, LAYOUT, OPTIONS)).lines[0];
  if (line === undefined) {
    throw new Error('expected a record 1000 line');
  }
  return line;
}

/** The `length` characters of `line` at the 1-based layout `position`. */
function at(line: string, position: number, length: number): string {
  return line.slice(position - 1, position - 1 + length);
}

describe('normalizeReport: record 1000 (skeleton)', () => {
  it('produces one 1000 and one 1020 record, in that order, with no notices', () => {
    const report = normalizeReport(minimalInput(), LAYOUT, OPTIONS);
    expect(report.taxYear).toBe(2024);
    expect(report.layout).toBe(LAYOUT);
    expect(report.records.map(r => [r.recordType, r.index])).toEqual([
      ['1000', 0],
      ['1020', 0],
    ]);
    expect(report.notices).toEqual([]);
    expect(report.omittedZeroCodes).toEqual([]);
  });

  it('defaults the layout to the one of input.taxYear', () => {
    expect(normalizeReport(minimalInput(), undefined, OPTIONS).layout).toBe(LAYOUT);
  });

  it('maps every 1000 key of the minimal input to its value and path', () => {
    const record = mainRecord();
    expect(record.values).toEqual({
      taxYear: 2024,
      'meta.softwareName': 'ACCOUNTER',
      'meta.saveDate': TODAY,
      'company.fileNumber': '514000009',
      'company.registeredName': 'חברה לדוגמה בע"מ',
      'company.mailingAddress': 'רחוב הרצל 1, תל אביב',
      'company.businessAddress': 'רחוב הרצל 1, תל אביב',
      'company.phone.prefix': '03',
      'company.phone.number': '1234567',
      hasForeignAppendix: false,
      'declarations.hasCapitalGainsAppendix': false,
      'declarations.hasTaxPlanningAction': false,
      'declarations.hadRelatedPartyTransactions': false,
      'declarations.controlsBodyOfPersons': false,
      'declarations.holdsRightsInBodyOfPersons': false,
      'declarations.appliesAccountingStandards': false,
      'declarations.directorsReceivedOpinion': false,
      'declarations.tookReportablePosition': false,
    });
    expect(record.paths).toEqual({
      taxYear: 'taxYear',
      'meta.softwareName': 'meta.softwareName',
      'meta.saveDate': 'meta.saveDate',
      'company.fileNumber': 'company.fileNumber',
      'company.registeredName': 'company.registeredName',
      'company.mailingAddress': 'company.mailingAddress',
      'company.businessAddress': 'company.businessAddress',
      'company.phone.prefix': 'company.phone.prefix',
      'company.phone.number': 'company.phone.number',
      hasForeignAppendix: '',
      'declarations.hasCapitalGainsAppendix': 'declarations.hasCapitalGainsAppendix',
      'declarations.hasTaxPlanningAction': 'declarations.hasTaxPlanningAction',
      'declarations.hadRelatedPartyTransactions': 'declarations.hadRelatedPartyTransactions',
      'declarations.controlsBodyOfPersons': 'declarations.controlsBodyOfPersons',
      'declarations.holdsRightsInBodyOfPersons': 'declarations.holdsRightsInBodyOfPersons',
      'declarations.appliesAccountingStandards': 'declarations.appliesAccountingStandards',
      'declarations.directorsReceivedOpinion': 'declarations.directorsReceivedOpinion',
      'declarations.tookReportablePosition': 'declarations.tookReportablePosition',
      'code:018': 'amounts["018"]',
      'code:072': 'amounts["072"]',
      'code:081': 'amounts["081"]',
      'code:094': 'amounts["094"]',
      'code:263': 'amounts["263"]',
      'code:273': '',
    });
    expect(record.codes).toEqual(
      new Map([
        ['018', 4],
        ['072', 0],
        ['081', 1000],
        ['094', 0],
        ['263', 1],
        ['273', 9],
      ]),
    );
    expect(record.countries).toEqual([]);
  });

  it('maps the optional company members, including the fax', () => {
    const record = mainRecord(
      minimalInput({
        company: {
          withholdingFileNumber: '914000001',
          vatFileNumber: '514000009',
          occupationDescription: 'ייעוץ',
          booksAddress: 'רחוב יפו 2, ירושלים',
          email: 'office@example.com',
          fax: { prefix: '052', number: '7654321' },
        },
      }),
    );
    expect(record.values).toMatchObject({
      'company.withholdingFileNumber': '914000001',
      'company.vatFileNumber': '514000009',
      'company.occupationDescription': 'ייעוץ',
      'company.booksAddress': 'רחוב יפו 2, ירושלים',
      'company.email': 'office@example.com',
      'company.fax.prefix': '052',
      'company.fax.number': '7654321',
    });
    expect(record.paths['company.fax.number']).toBe('company.fax.number');
    expect(record.paths['company.withholdingFileNumber']).toBe('company.withholdingFileNumber');
  });

  it('every key it sets is a field of record 1000 and has a path', () => {
    const record = mainRecord(
      minimalInput({ company: { email: 'a@b.co', fax: { prefix: '02', number: '1111111' } } }),
    );
    const keys = new Set(LAYOUT.records['1000'].fields.map(field => field.key));
    for (const key of Object.keys(record.values)) {
      expect(keys).toContain(key);
      expect(record.paths).toHaveProperty([key]);
    }
    for (const code of record.codes.keys()) {
      expect(record.paths).toHaveProperty([`code:${code}`]);
    }
  });

  describe('meta defaults (SPEC §7.4)', () => {
    it("defaults softwareName to 'ACCOUNTER' and saveDate to options.today()", () => {
      const record = mainRecord(minimalInput(), { today: () => '2025-01-02' });
      expect(record.values['meta.softwareName']).toBe('ACCOUNTER');
      expect(record.values['meta.saveDate']).toBe('2025-01-02');
    });

    it('takes meta values from the input when given', () => {
      const record = mainRecord(
        minimalInput({ meta: { softwareName: '  My   Soft ', saveDate: '2024-05-01' } }),
      );
      expect(record.values['meta.softwareName']).toBe('My Soft');
      expect(record.values['meta.saveDate']).toBe('2024-05-01');
    });

    it('defaults saveDate to today in Asia/Jerusalem when options.today is absent', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2024-03-15T22:30:00Z'));
        const report = normalizeReport(minimalInput());
        expect(report.records[0]?.values['meta.saveDate']).toBe('2024-03-16');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('todayInJerusalem', () => {
    it.each([
      // Winter (UTC+2)
      ['2024-03-15T21:59:59Z', '2024-03-15'],
      ['2024-03-15T22:00:00Z', '2024-03-16'],
      // Summer (UTC+3)
      ['2024-07-01T20:59:59Z', '2024-07-01'],
      ['2024-07-01T21:00:00Z', '2024-07-02'],
      // Around midnight UTC
      ['2024-12-31T23:59:59Z', '2025-01-01'],
      ['2025-01-01T00:00:00Z', '2025-01-01'],
      ['2024-06-30T23:59:59Z', '2024-07-01'],
    ])('%s → %s', (instant, expected) => {
      expect(todayInJerusalem(new Date(instant))).toBe(expected);
    });

    it('defaults to the current time', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2024-07-01T21:00:00Z'));
        expect(todayInJerusalem()).toBe('2024-07-02');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('text normalization (SPEC §4.3)', () => {
    it('passes text fields through normalizeText', () => {
      const record = mainRecord(
        minimalInput({
          company: {
            registeredName: '  חברה\u00A0 לדוגמה\u200F בע\u201Dמ ',
            mailingAddress: 'רחוב\tהרצל 1 \u2013 תל אביב',
          },
        }),
      );
      expect(record.values['company.registeredName']).toBe('חברה לדוגמה בע"מ');
      expect(record.values['company.mailingAddress']).toBe('רחוב הרצל 1 - תל אביב');
    });

    it('treats text that is empty after normalization as absent (SPEC §4.1)', () => {
      const record = mainRecord(minimalInput({ company: { email: ' \u200E ', booksAddress: '' } }));
      expect(record.values).not.toHaveProperty(['company.email']);
      expect(record.values).not.toHaveProperty(['company.booksAddress']);
      expect(record.paths).not.toHaveProperty(['company.email']);
    });
  });

  describe('digit strings', () => {
    it('keeps a digit string that is not all digits as-is (rules report it)', () => {
      const record = mainRecord(minimalInput({ company: { fileNumber: '12a' } }));
      expect(record.values['company.fileNumber']).toBe('12a');
    });

    it('keeps phone numbers as digit strings with their leading zeros', () => {
      const record = mainRecord(minimalInput({ company: { phone: { number: '0123456' } } }));
      expect(record.values['company.phone.number']).toBe('0123456');
    });
  });

  describe('derived values (SPEC §7.4)', () => {
    it('832 and 833 are "no" while no appendix exists', () => {
      const record = mainRecord();
      expect(record.values.hasForeignAppendix).toBe(false);
      expect(record.values['declarations.hasCapitalGainsAppendix']).toBe(false);
    });

    it('832 is "yes" when a foreign appendix exists', () => {
      const record = mainRecord(
        minimalInput({ foreignAppendix: { taxRefundDeclaration: false, amounts: {} } }),
      );
      expect(record.values.hasForeignAppendix).toBe(true);
    });

    it.each([
      [true, false, 1],
      [false, true, 2],
      [true, true, 3],
      [false, false, 9],
    ])(
      'code 273: directorsReceivedOpinion %s, tookReportablePosition %s → %i',
      (directorsReceivedOpinion, tookReportablePosition, expected) => {
        const record = mainRecord(
          minimalInput({ declarations: { directorsReceivedOpinion, tookReportablePosition } }),
        );
        expect(record.codes.get('273')).toBe(expected);
        expect(record.values['declarations.directorsReceivedOpinion']).toBe(
          directorsReceivedOpinion,
        );
        expect(record.values['declarations.tookReportablePosition']).toBe(tookReportablePosition);
        expect(record.paths['code:273']).toBe('');
      },
    );

    it('code 008 = 1 when appliesAccountingStandards', () => {
      const record = mainRecord(
        minimalInput({ declarations: { appliesAccountingStandards: true } }),
      );
      expect(record.codes.get('008')).toBe(1);
      expect(record.paths['code:008']).toBe('');
      expect(record.values['declarations.appliesAccountingStandards']).toBe(true);
    });

    it('code 008 is omitted when not appliesAccountingStandards', () => {
      expect(mainRecord().codes.has('008')).toBe(false);
    });
  });

  describe('amounts (SPEC §4.5)', () => {
    it('omits a zero for a code that is not zeroAllowed and lists it in omittedZeroCodes', () => {
      const report = normalizeReport(
        minimalInput({ amounts: { '010': 0, '070': 0, '020': 5 } }),
        LAYOUT,
        OPTIONS,
      );
      const record = report.records[0];
      expect(record?.codes.has('010')).toBe(false);
      expect(record?.codes.has('070')).toBe(false);
      expect(record?.paths).not.toHaveProperty(['code:010']);
      expect(record?.codes.get('020')).toBe(5);
      expect(record?.paths['code:020']).toBe('amounts["020"]');
      expect(report.omittedZeroCodes).toEqual([
        { record: '1000', recordIndex: 0, code: '010' },
        { record: '1000', recordIndex: 0, code: '070' },
      ]);
    });

    it('keeps a zero for a zeroAllowed code', () => {
      const record = mainRecord(minimalInput({ amounts: { '072': 0, '121': 0 } }));
      expect(record.codes.get('072')).toBe(0);
      expect(record.codes.get('121')).toBe(0);
      expect(record.paths['code:072']).toBe('amounts["072"]');
      expect(record.paths['code:121']).toBe('amounts["121"]');
    });

    it('skips codes whose value is undefined', () => {
      const record = mainRecord(minimalInput({ amounts: { '010': undefined } }));
      expect(record.codes.has('010')).toBe(false);
    });

    it('keeps codes in ascending code order', () => {
      const record = mainRecord(minimalInput({ amounts: { '299': 7, '010': 3 } }));
      const codes = [...record.codes.keys()];
      expect(codes).toEqual([...codes].sort());
    });
  });
});

describe('normalizeReport: record 1000 declarations and preparer', () => {
  it('maps the preparer (1000@563–831) to its keys, encoded values and paths', () => {
    const input = fullDeclarationsInput();
    const record = mainRecord(input);
    const line = mainLine(input);
    const expected: Array<[string, unknown, number, string]> = [
      ['preparer.officeName', 'משרד רואי חשבון', 563, 'משרד רואי חשבון'.padStart(50)],
      ['preparer.contactName', 'דנה כהן', 613, 'דנה כהן'.padStart(50)],
      ['preparer.name', 'יוסי לוי', 663, 'יוסי לוי'.padStart(50)],
      ['preparer.profession', 'רואה חשבון', 713, 'רואה חשבון'.padStart(50)],
      ['preparer.licensedDealerNumber', '012345678', 763, '012345678'],
      ['preparer.address', 'רחוב יפו 10, ירושלים', 772, 'רחוב יפו 10, ירושלים'.padStart(50)],
      // 822 is a numeric prefix field: zero-padded (SPEC §15 A-19).
      ['preparer.phone.prefix', '02', 822, '002'],
      ['preparer.phone.number', '6543210', 825, '6543210'],
    ];
    for (const [key, value, position, encoded] of expected) {
      expect(record.values[key]).toBe(value);
      expect(record.paths[key]).toBe(key);
      expect(at(line, position, encoded.length)).toBe(encoded);
    }
  });

  it('normalizes preparer text and drops an invalid preparer phone prefix with a notice', () => {
    const report = normalizeReport(
      fullDeclarationsInput({
        preparer: { name: '  יוסי\u00A0 לוי ', phone: { prefix: '01' as PhonePrefix } },
      }),
      LAYOUT,
      OPTIONS,
    );
    const record = report.records[0];
    expect(record?.values['preparer.name']).toBe('יוסי לוי');
    expect(record?.values).not.toHaveProperty(['preparer.phone.prefix']);
    expect(record?.values['preparer.phone.number']).toBe('6543210');
    expect(report.notices).toEqual([
      expect.objectContaining({
        ruleId: 'field.phonePrefix',
        severity: 'warning',
        path: 'preparer.phone.prefix',
        value: '01',
      }),
    ]);
  });

  it('leaves every preparer field absent without a preparer', () => {
    const record = mainRecord();
    expect(Object.keys(record.values).filter(key => key.startsWith('preparer.'))).toEqual([]);
    const line = mainLine(minimalInput());
    expect(at(line, 763, 9)).toBe('000000000');
    expect(at(line, 822, 3)).toBe('000');
  });

  it.each([
    ['obliged', 1],
    ['notObliged', 2],
    ['notRelevant', 3],
  ] as const)('form6111Obligation %s → 834 = %i', (form6111Obligation, code) => {
    const input = minimalInput({ declarations: { form6111Obligation } });
    const record = mainRecord(input);
    expect(record.values['declarations.form6111Obligation']).toBe(code);
    expect(record.paths['declarations.form6111Obligation']).toBe('declarations.form6111Obligation');
    expect(at(mainLine(input), 834, 1)).toBe(String(code));
  });

  it.each([
    ['consolidatedUnderSection23', 1],
    ['consolidatesWithParent', 2],
    ['notRelevant', 3],
  ] as const)('consolidatedReport %s → 875 = %i', (consolidatedReport, code) => {
    const input = minimalInput({ declarations: { consolidatedReport } });
    const record = mainRecord(input);
    expect(record.values['declarations.consolidatedReport']).toBe(code);
    expect(record.paths['declarations.consolidatedReport']).toBe('declarations.consolidatedReport');
    expect(at(mainLine(input), 875, 1)).toBe(String(code));
  });

  it('writes 0 for an absent enum declaration', () => {
    const line = mainLine(minimalInput());
    expect(at(line, 834, 1)).toBe('0');
    expect(at(line, 875, 1)).toBe('0');
  });

  it('keeps an enum value that is not one of its literals as-is, for the field rules', () => {
    const record = mainRecord(
      minimalInput({ declarations: { form6111Obligation: 'sometimes' as 'obliged' } }),
    );
    expect(record.values['declarations.form6111Obligation']).toBe('sometimes');
  });

  it('familyCompany → 836 = 1 and 837 = representativeFileNumber', () => {
    const input = minimalInput({
      declarations: { familyCompany: { representativeFileNumber: '300000007' } },
    });
    const record = mainRecord(input);
    const line = mainLine(input);
    expect(record.values['declarations.familyCompany.isFamilyCompany']).toBe(true);
    expect(record.paths['declarations.familyCompany.isFamilyCompany']).toBe(
      'declarations.familyCompany',
    );
    expect(record.values['declarations.familyCompany.representativeFileNumber']).toBe('300000007');
    expect(record.paths['declarations.familyCompany.representativeFileNumber']).toBe(
      'declarations.familyCompany.representativeFileNumber',
    );
    expect(at(line, 836, 1)).toBe('1');
    expect(at(line, 837, 9)).toBe('300000007');
  });

  it('beneficiaryEnterprise → 851 = 1 and 852 = the notice date', () => {
    const input = minimalInput({
      declarations: { beneficiaryEnterprise: { noticeDate: '2023-05-14' } },
    });
    const record = mainRecord(input);
    const line = mainLine(input);
    expect(record.values['declarations.beneficiaryEnterprise.marked']).toBe(true);
    expect(record.paths['declarations.beneficiaryEnterprise.marked']).toBe(
      'declarations.beneficiaryEnterprise',
    );
    expect(record.values['declarations.beneficiaryEnterprise.noticeDate']).toBe('2023-05-14');
    expect(record.paths['declarations.beneficiaryEnterprise.noticeDate']).toBe(
      'declarations.beneficiaryEnterprise.noticeDate',
    );
    expect(at(line, 851, 1)).toBe('1');
    expect(at(line, 852, 10)).toBe('14/05/2023');
  });

  it('specialYear → 863 = 1 and 864 = the balance sheet date', () => {
    const input = minimalInput({
      declarations: { specialYear: { balanceSheetDate: '2024-09-30' } },
    });
    const record = mainRecord(input);
    const line = mainLine(input);
    expect(record.values['declarations.specialYear.marked']).toBe(true);
    expect(record.paths['declarations.specialYear.marked']).toBe('declarations.specialYear');
    expect(record.values['declarations.specialYear.balanceSheetDate']).toBe('2024-09-30');
    expect(record.paths['declarations.specialYear.balanceSheetDate']).toBe(
      'declarations.specialYear.balanceSheetDate',
    );
    expect(at(line, 863, 1)).toBe('1');
    expect(at(line, 864, 10)).toBe('30/09/2024');
  });

  it('leaves the presence flags unmarked without their objects', () => {
    const record = mainRecord();
    const line = mainLine(minimalInput());
    for (const key of [
      'declarations.familyCompany.isFamilyCompany',
      'declarations.familyCompany.representativeFileNumber',
      'declarations.beneficiaryEnterprise.marked',
      'declarations.beneficiaryEnterprise.noticeDate',
      'declarations.specialYear.marked',
      'declarations.specialYear.balanceSheetDate',
    ]) {
      expect(record.values).not.toHaveProperty([key]);
    }
    expect(at(line, 836, 10)).toBe('0000000000');
    expect(at(line, 851, 1)).toBe('0');
    expect(at(line, 852, 10)).toBe(' '.repeat(10));
    expect(at(line, 863, 1)).toBe('0');
    expect(at(line, 864, 10)).toBe(' '.repeat(10));
  });

  it('reportablePositions [12, 7] → 1034 = 012, 1037 = 007, 1040–1046 = 000', () => {
    const input = minimalInput({
      declarations: { tookReportablePosition: true, reportablePositions: [12, 7] },
    });
    const record = mainRecord(input);
    const line = mainLine(input);
    expect(record.values['declarations.reportablePositions[0]']).toBe(12);
    expect(record.values['declarations.reportablePositions[1]']).toBe(7);
    expect(record.values).not.toHaveProperty(['declarations.reportablePositions[2]']);
    expect(record.paths['declarations.reportablePositions[0]']).toBe(
      'declarations.reportablePositions[0]',
    );
    expect(record.paths['declarations.reportablePositions[1]']).toBe(
      'declarations.reportablePositions[1]',
    );
    expect(at(line, 1034, 3)).toBe('012');
    expect(at(line, 1037, 3)).toBe('007');
    expect(at(line, 1040, 3)).toBe('000');
    expect(at(line, 1043, 3)).toBe('000');
    expect(at(line, 1046, 3)).toBe('000');
  });

  it('writes only the first five reportable positions and raises a notice for the sixth', () => {
    const input = minimalInput({
      declarations: { tookReportablePosition: true, reportablePositions: [1, 2, 3, 4, 5, 6] },
    });
    expect(normalizeReport(input, LAYOUT, OPTIONS).notices).toEqual([
      expect.objectContaining({
        ruleId: 'main.reportablePositions.max',
        severity: 'error',
        path: 'declarations.reportablePositions[5]',
        value: 6,
      }),
    ]);
    const record = mainRecord(input);
    expect(
      Object.keys(record.values).filter(key => key.startsWith('declarations.reportablePositions')),
    ).toHaveLength(5);
    expect(at(mainLine(input), 1034, 15)).toBe('001002003004005');
  });

  it.each([
    ['requestsAdvancePayments', 883],
    ['hasBuildingIncome', 884],
    ['partOfMultinationalGroup', 1033],
  ] as const)('%s is yes/no at %i: 1, 2, and 0 when absent', (member, position) => {
    const key = `declarations.${member}`;
    for (const [value, encoded] of [
      [true, '1'],
      [false, '2'],
      [undefined, '0'],
    ] as const) {
      const input = minimalInput({ declarations: { [member]: value } });
      const record = mainRecord(input);
      expect(record.values[key]).toBe(value);
      expect(record.paths[key]).toBe(value === undefined ? undefined : key);
      expect(at(mainLine(input), position, 1)).toBe(encoded);
    }
  });

  it.each([
    ['financialStatementsAttached', 835],
    ['isHouseCompany', 846],
    ['form1343Attached', 847],
    ['form1344Attached', 848],
    ['claimsCapitalInvestmentLawBenefits', 849],
    ['preferredEnterprise', 850],
    ['dividendDistributed', 862],
    ['foreignInvestors', 874],
    ['partnerInPartnership', 876],
    ['isKibbutz', 877],
    ['isTrustBeneficiary', 886],
    ['nonDeductibleSalaryExpenses', 1031],
    ['fewMembersCompany62A', 1032],
    ['noBankAccount', 1064],
  ] as const)('%s is a flag at %i: 1 when marked, 0 otherwise', (member, position) => {
    const key = `declarations.${member}`;
    const marked = minimalInput({ declarations: { [member]: true } });
    expect(mainRecord(marked).values[key]).toBe(true);
    expect(mainRecord(marked).paths[key]).toBe(key);
    expect(at(mainLine(marked), position, 1)).toBe('1');
    expect(at(mainLine(minimalInput({ declarations: { [member]: false } })), position, 1)).toBe(
      '0',
    );
    expect(at(mainLine(minimalInput()), position, 1)).toBe('0');
  });

  describe('833 has capital-gains appendix (SPEC §7.4)', () => {
    it('hasCapitalGainsAppendix true forces 833 = yes', () => {
      const input = minimalInput({ declarations: { hasCapitalGainsAppendix: true } });
      const record = mainRecord(input);
      expect(record.values['declarations.hasCapitalGainsAppendix']).toBe(true);
      expect(record.paths['declarations.hasCapitalGainsAppendix']).toBe(
        'declarations.hasCapitalGainsAppendix',
      );
      expect(at(mainLine(input), 833, 1)).toBe('1');
    });

    it.each([false, undefined])('hasCapitalGainsAppendix %s leaves 833 derived (no)', value => {
      const input = minimalInput({ declarations: { hasCapitalGainsAppendix: value } });
      expect(mainRecord(input).values['declarations.hasCapitalGainsAppendix']).toBe(false);
      expect(at(mainLine(input), 833, 1)).toBe('2');
    });
  });

  it('raises no notices for the full declarations input', () => {
    expect(normalizeReport(fullDeclarationsInput(), LAYOUT, OPTIONS).notices).toEqual([]);
  });
});

describe('normalizeReport: record 1000 other income, attachments, capital-gains summary, qualifying company', () => {
  it('maps every member to its key, encoded value and path', () => {
    const input = fullMainInput();
    const record = mainRecord(input);
    const line = mainLine(input);
    const expected: Array<[string, unknown, number, string]> = [
      ['otherTaxableIncome.source', 'דמי שכירות', 887, 'דמי שכירות'.padStart(50)],
      ['otherTaxableIncome.amount', 25_000, 937, '000000025000'],
      // percentX100: × 100 with alphanumeric padding (SPEC §15 A-2).
      ['otherTaxableIncome.ratePercent', 10.23, 949, ' 1023'],
      ['attachments.donationReceiptsCount', 2, 954, '002'],
      ['attachments.withholdingCertificatesCount', 3, 957, '003'],
      ['capitalGainsSummary.totalAppendicesCount', 4, 960, '04'],
      ['capitalGainsSummary.untransmittedCount', 3, 962, '03'],
      ['capitalGainsSummary.reasons.lossOrNoGain', true, 964, '1'],
      ['capitalGainsSummary.reasons.overFiveImprovementBalances', true, 965, '1'],
      ['capitalGainsSummary.reasons.over14Appendices', true, 966, '1'],
      ['capitalGainsSummary.reasons.other', true, 967, '1'],
      ['capitalGainsSummary.reasons.otherText', 'העסקה בוטלה', 968, 'העסקה בוטלה'.padStart(50)],
      ['qualifyingCompany.purchased', true, 1065, '1'],
      ['qualifyingCompany.israeliPurchaseAmount', 1_000_000, 1066, '000001000000'],
      ['qualifyingCompany.foreignPurchaseAmount', 2_500_000, 1078, '000002500000'],
      ['qualifyingCompany.amortizationClaimed', true, 1090, '1'],
      // amountX: digits with alphanumeric padding (SPEC §15 A-21).
      ['qualifyingCompany.amortizationAmount', 150_000, 1091, '150000'.padStart(12)],
    ];
    for (const [key, value, position, encoded] of expected) {
      expect(record.values[key]).toBe(value);
      expect(record.paths[key]).toBe(key);
      expect(at(line, position, encoded.length)).toBe(encoded);
    }
  });

  it('otherTaxableIncome.ratePercent 10.23 → 949 = " 1023", 100 → "10000"', () => {
    expect(at(mainLine(minimalInput({ otherTaxableIncome: { ratePercent: 10.23 } })), 949, 5)).toBe(
      ' 1023',
    );
    expect(at(mainLine(minimalInput({ otherTaxableIncome: { ratePercent: 100 } })), 949, 5)).toBe(
      '10000',
    );
  });

  it('normalizes the text members', () => {
    const record = mainRecord(
      minimalInput({
        otherTaxableIncome: { source: '  דמי\u00A0 שכירות ' },
        capitalGainsSummary: { reasons: { other: true, otherText: '  ' } },
      }),
    );
    expect(record.values['otherTaxableIncome.source']).toBe('דמי שכירות');
    expect(record.values).not.toHaveProperty(['capitalGainsSummary.reasons.otherText']);
  });

  it('qualifyingCompany.amortizationAmount 0 is kept and written as "0" (SPEC §15 A-21)', () => {
    const input = minimalInput({
      qualifyingCompany: { amortizationClaimed: true, amortizationAmount: 0 },
    });
    const record = mainRecord(input);
    expect(record.values['qualifyingCompany.amortizationAmount']).toBe(0);
    expect(record.paths['qualifyingCompany.amortizationAmount']).toBe(
      'qualifyingCompany.amortizationAmount',
    );
    expect(at(mainLine(input), 1091, 12)).toBe('0'.padStart(12));
  });

  it.each([
    ['purchased', 1065],
    ['amortizationClaimed', 1090],
  ] as const)(
    'qualifyingCompany.%s is yes/no at %i: 1, 2, and 0 when absent',
    (member, position) => {
      const key = `qualifyingCompany.${member}`;
      for (const [value, encoded] of [
        [true, '1'],
        [false, '2'],
        [undefined, '0'],
      ] as const) {
        const input = minimalInput({ qualifyingCompany: { [member]: value } });
        const record = mainRecord(input);
        expect(record.values[key]).toBe(value);
        expect(record.paths[key]).toBe(value === undefined ? undefined : key);
        expect(at(mainLine(input), position, 1)).toBe(encoded);
      }
    },
  );

  it('writes the absent value for every member when the groups are absent', () => {
    const record = mainRecord();
    for (const prefix of [
      'otherTaxableIncome.',
      'attachments.',
      'capitalGainsSummary.',
      'qualifyingCompany.',
    ]) {
      expect(Object.keys(record.values).filter(key => key.startsWith(prefix))).toEqual([]);
    }
    const line = mainLine(minimalInput());
    expect(at(line, 887, 50)).toBe(' '.repeat(50));
    expect(at(line, 937, 12)).toBe('0'.repeat(12));
    expect(at(line, 949, 5)).toBe(' '.repeat(5));
    expect(at(line, 954, 10)).toBe('0'.repeat(10));
    expect(at(line, 964, 4)).toBe('0000');
    expect(at(line, 968, 50)).toBe(' '.repeat(50));
    expect(at(line, 1065, 1)).toBe('0');
    expect(at(line, 1066, 24)).toBe('0'.repeat(24));
    expect(at(line, 1090, 1)).toBe('0');
    expect(at(line, 1091, 12)).toBe(' '.repeat(12));
  });

  it('writes 0 for false capital-gains reasons', () => {
    const input = minimalInput({
      capitalGainsSummary: {
        reasons: {
          lossOrNoGain: false,
          overFiveImprovementBalances: false,
          over14Appendices: false,
          other: false,
        },
      },
    });
    expect(at(mainLine(input), 964, 4)).toBe('0000');
  });

  describe('833 has capital-gains appendix (SPEC §7.4)', () => {
    it.each([true, false, undefined])(
      'untransmittedCount > 0 makes 833 = yes (hasCapitalGainsAppendix %s)',
      hasCapitalGainsAppendix => {
        const input = minimalInput({
          declarations: { hasCapitalGainsAppendix },
          capitalGainsSummary: { untransmittedCount: 3 },
        });
        const record = mainRecord(input);
        expect(record.values['declarations.hasCapitalGainsAppendix']).toBe(true);
        expect(at(mainLine(input), 833, 1)).toBe('1');
      },
    );

    it('untransmittedCount 0 leaves 833 = no', () => {
      const input = minimalInput({ capitalGainsSummary: { untransmittedCount: 0 } });
      expect(mainRecord(input).values['declarations.hasCapitalGainsAppendix']).toBe(false);
      expect(at(mainLine(input), 833, 1)).toBe('2');
    });
  });

  it('raises no notices for the full main input', () => {
    expect(normalizeReport(fullMainInput(), LAYOUT, OPTIONS).notices).toEqual([]);
  });
});

describe('normalizeReport: record 1000 derived codes (SPEC §7.4)', () => {
  const BANK_ACCOUNT = { bank: '12', branch: '345', account: '678' };

  it('bankAccount → 277 = account, 278 = bank then branch, 280 = 1', () => {
    const input = minimalInput({ bankAccount: BANK_ACCOUNT });
    const record = mainRecord(input);
    expect(record.codes.get('277')).toBe(678);
    expect(record.codes.get('278')).toBe(12_345);
    expect(record.codes.get('280')).toBe(1);
    expect(record.paths['code:277']).toBe('');
    expect(record.paths['code:278']).toBe('');
    expect(record.paths['code:280']).toBe('');
    // 1000@2185: the code-amount section, in ascending code order after 273 = 9.
    expect(mainLine(input).slice(2184)).toContain('2739' + '277000000000678' + '27812345' + '2801');
    expect(normalizeReport(input, LAYOUT, OPTIONS).notices).toEqual([]);
  });

  it('keeps the leading zeros of the bank in 278 (bank 2 digits, branch 3 digits)', () => {
    const input = minimalInput({
      bankAccount: { bank: '01', branch: '002', account: '000000003' },
    });
    expect(mainRecord(input).codes.get('278')).toBe(1002);
    expect(mainRecord(input).codes.get('277')).toBe(3);
    expect(mainLine(input).slice(2184)).toContain('27801002');
  });

  it('writes no bank codes without bankAccount', () => {
    const record = mainRecord();
    expect(['277', '278', '280'].filter(code => record.codes.has(code))).toEqual([]);
  });

  it.each([
    ['bank', { bank: '1' }, 'bankAccount.bank'],
    ['bank', { bank: '123' }, 'bankAccount.bank'],
    ['branch', { branch: '34' }, 'bankAccount.branch'],
    ['branch', { branch: '3a5' }, 'bankAccount.branch'],
    ['account', { account: '' }, 'bankAccount.account'],
    ['account', { account: '1234567890' }, 'bankAccount.account'],
  ])(
    'a malformed %s (%o) raises main.bankAccount.format at %s and writes no bank codes',
    (_, overrides, path) => {
      const input = minimalInput({ bankAccount: { ...BANK_ACCOUNT, ...overrides } });
      const report = normalizeReport(input, LAYOUT, OPTIONS);
      expect(report.notices).toEqual([
        expect.objectContaining({
          ruleId: 'main.bankAccount.format',
          severity: 'error',
          path,
          recordType: '1000',
          recordIndex: 0,
        }),
      ]);
      const record = report.records[0];
      expect(['277', '278', '280'].filter(code => record?.codes.has(code))).toEqual([]);
    },
  );

  it.each([
    ['obliged', 8],
    ['notObliged', 9],
  ] as const)('form6111Obligation %s → 297 = %i', (form6111Obligation, expected) => {
    const input = minimalInput({ declarations: { form6111Obligation } });
    const record = mainRecord(input);
    expect(record.codes.get('297')).toBe(expected);
    expect(record.paths['code:297']).toBe('');
    expect(mainLine(input).slice(2184)).toContain(`297${expected}`);
  });

  it.each(['notRelevant', undefined] as const)(
    'form6111Obligation %s → no 297',
    form6111Obligation => {
      expect(
        mainRecord(minimalInput({ declarations: { form6111Obligation } })).codes.has('297'),
      ).toBe(false);
    },
  );

  it('capitalGainsSummary.untransmittedCount 3 → 028 = 3', () => {
    const input = minimalInput({ capitalGainsSummary: { untransmittedCount: 3 } });
    const record = mainRecord(input);
    expect(record.codes.get('028')).toBe(3);
    expect(record.paths['code:028']).toBe('');
    expect(mainLine(input).slice(2184)).toContain('02803');
  });

  it.each([0, undefined])('untransmittedCount %s → no 028', untransmittedCount => {
    const input = minimalInput({ capitalGainsSummary: { untransmittedCount } });
    expect(mainRecord(input).codes.has('028')).toBe(false);
  });
});
