import { getLayout } from '../../src/layout/registry.js';
import type { NormalizedRecord } from '../../src/model/normalized.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { todayInJerusalem } from '../../src/normalize/today.js';
import { minimalInput } from '../fixtures/builders.js';

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

    it.each([[''], ['   '], ['\u200F'], ['\u00A0\t']])(
      "defaults a softwareName that normalizes to empty (%j) to 'ACCOUNTER'",
      softwareName => {
        const record = mainRecord(minimalInput({ meta: { softwareName } }));
        expect(record.values['meta.softwareName']).toBe('ACCOUNTER');
      },
    );

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
