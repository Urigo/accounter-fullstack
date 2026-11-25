import { describe, expect, it } from 'vitest';
import {
  generate1214,
  getLayout,
  parse1214,
  validate1214,
} from '@accounter/opcn1214-generator';
import type { AnnualTaxData } from '../../../reports/helpers/annual-tax-data.helper.js';
import type { Report1214ProfileProto, ShareholderProto } from '../../types.js';
import { CODE_SOURCES, type Report1214CodeSources } from '../report-1214-amounts.helper.js';
import { collectReport1214Issues, issueToGql } from '../report-1214-issues.helper.js';
import { REPORT_1214_PHONE_PREFIXES } from '../report-1214-profile.helper.js';
import {
  assembleReport1214Input,
  composeAddress,
  parseIsraeliPhone,
  REPORT_1214_MAPPING_RULES,
  type AssembleReport1214InputParams,
  type Report1214BusinessIdentity,
} from '../report-1214-input.helper.js';

const OWNER_ID = '00000000-0000-0000-0000-0000000000aa';
const YEAR = 2024;

describe('parseIsraeliPhone', () => {
  it.each([
    ['03-1234567', { prefix: '03', number: '1234567' }],
    ['031234567', { prefix: '03', number: '1234567' }],
    ['(03) 123 45 67', { prefix: '03', number: '1234567' }],
    ['02.123.4567', { prefix: '02', number: '1234567' }],
    ['054-1234567', { prefix: '054', number: '1234567' }],
    ['054 123 4567', { prefix: '054', number: '1234567' }],
    ['072-2345678', { prefix: '072', number: '2345678' }],
    ['+972-54-1234567', { prefix: '054', number: '1234567' }],
    ['+972 3 123 4567', { prefix: '03', number: '1234567' }],
    ['972541234567', { prefix: '054', number: '1234567' }],
    ['00972-9-1234567', { prefix: '09', number: '1234567' }],
    ['+972 (0)3 1234567', { prefix: '03', number: '1234567' }],
    ['  08-1234567  ', { prefix: '08', number: '1234567' }],
    ['0721234567', { prefix: '072', number: '1234567' }],
    ['\u200f03-1234567\u200f', { prefix: '03', number: '1234567' }], // RLM-wrapped, as pasted from Hebrew text
    ['\u202a+972-54-1234567\u202c', { prefix: '054', number: '1234567' }],
  ])('parses %j', (raw, expected) => {
    expect(parseIsraeliPhone(raw)).toEqual(expected);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['   '],
    ['1234567'], // no prefix
    ['03-123456'], // 6 digits
    ['03-12345678'], // 8 digits
    ['051-1234567'], // prefix form 1214 does not allow
    ['05-1234567'], // incomplete mobile prefix
    ['+1 212 555 1234'], // foreign
    ['+44 20 7946 0958'],
    ['03-1234567 ext. 12'], // extension
    ['not a phone'],
    ['1-800-123-456'], // toll-free
    ['1700-500-500'],
  ])('rejects %j', raw => {
    expect(parseIsraeliPhone(raw)).toBeNull();
  });
});

describe('parseIsraeliPhone and validate1214', () => {
  it.each(REPORT_1214_PHONE_PREFIXES)('accepts a phone with prefix %s', prefix => {
    const phone = parseIsraeliPhone(`${prefix}-2345678`);
    expect(phone).toEqual({ prefix, number: '2345678' });
    const { input } = assemble({ profile: profile({ company: { phone: phone! } }) });
    const result = validate1214(input);
    expect(result.errors).toEqual([]);
  });
});

describe('composeAddress', () => {
  it('joins street, city and zip, skipping empty parts', () => {
    expect(composeAddress('רחוב הרצל 1', 'תל אביב', '6100000')).toBe(
      'רחוב הרצל 1, תל אביב 6100000',
    );
    expect(composeAddress(' רחוב הרצל 1 ', ' ', null)).toBe('רחוב הרצל 1');
    expect(composeAddress(null, 'תל אביב', '6100000')).toBe('תל אביב 6100000');
    expect(composeAddress(null, '', undefined)).toBeUndefined();
  });
});

const business: Report1214BusinessIdentity = {
  name: 'Example Ltd',
  hebrew_name: 'חברה לדוגמה בע"מ',
  vat_number: '514000009',
  address: 'Herzl 1',
  address_hebrew: 'רחוב הרצל 1',
  city: 'תל אביב',
  zip_code: '6100000',
  email: 'office@example.com',
  phone_number: '+972-3-1234567',
};

const completeDeclarations = {
  hasTaxPlanningAction: false,
  hadRelatedPartyTransactions: false,
  controlsBodyOfPersons: false,
  holdsRightsInBodyOfPersons: false,
  appliesAccountingStandards: false,
  directorsReceivedOpinion: false,
  tookReportablePosition: false,
};

function profile(overrides: Partial<Report1214ProfileProto> = {}): Report1214ProfileProto {
  return {
    ownerId: OWNER_ID,
    year: YEAR,
    company: {},
    declarations: completeDeclarations,
    preparer: {},
    attachments: {},
    bankAccount: {},
    otherTaxableIncome: {},
    capitalGainsSummary: {},
    qualifyingCompany: {},
    relatedCompanies: [],
    rdInvestments: [],
    amountOverrides: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
    updatedAt: null,
    ...overrides,
  };
}

function shareholder(overrides: Partial<ShareholderProto> = {}): ShareholderProto {
  return {
    id: 'sh-1',
    ownerId: OWNER_ID,
    year: YEAR,
    businessId: null,
    idNumber: '123456782',
    fullName: 'ישראל ישראלי',
    isControllingShareholder: true,
    dividendRightsPercent: 100,
    votingRightsPercent: null,
    otherRightsPercent: null,
    isMaterialShareholder: null,
    salaryMonths1To9: null,
    salaryMonths10To12: null,
    otherPayments: null,
    sortOrder: 0,
    ...overrides,
  };
}

function assemble(overrides: Partial<AssembleReport1214InputParams> = {}) {
  return assembleReport1214Input({
    year: YEAR,
    business,
    adminBusiness: { company_tax_id: null },
    profile: profile(),
    shareholders: [shareholder()],
    ...overrides,
  });
}

const ruleIds = (issues: ReadonlyArray<{ ruleId: string }>) => issues.map(issue => issue.ruleId);

describe('assembleReport1214Input', () => {
  it('takes the company identity from the books', () => {
    const { input, mappingIssues } = assemble({ adminBusiness: { company_tax_id: '951400001' } });
    expect(mappingIssues).toEqual([]);
    expect(input!.company).toEqual({
      fileNumber: '514000009',
      registeredName: 'חברה לדוגמה בע"מ',
      withholdingFileNumber: '951400001',
      vatFileNumber: '514000009',
      mailingAddress: 'רחוב הרצל 1, תל אביב 6100000',
      businessAddress: 'רחוב הרצל 1, תל אביב 6100000',
      email: 'office@example.com',
      phone: { prefix: '03', number: '1234567' },
    });
    expect(input!.taxYear).toBe(2024);
  });

  it('falls back to the English name and address', () => {
    const { input } = assemble({
      business: { ...business, hebrew_name: null, address_hebrew: null, city: null, zip_code: '' },
    });
    expect(input!.company.registeredName).toBe('Example Ltd');
    expect(input!.company.mailingAddress).toBe('Herzl 1');
  });

  it('falls back to the English address when the Hebrew one is blank', () => {
    const { input } = assemble({ business: { ...business, address_hebrew: '   ' } });
    expect(input!.company.mailingAddress).toBe('Herzl 1, תל אביב 6100000');
  });

  it('picks the withholding file as the 6111 report does, unless the profile overrides it', () => {
    const withholding = (adminBusiness: Record<string, string | null>, override?: string) =>
      assemble({
        adminBusiness,
        profile: profile({ company: override ? { withholdingFileNumber: override } : {} }),
      }).input!.company.withholdingFileNumber;

    expect(withholding({ company_tax_id: '951400001' })).toBe('951400001');
    // the company's own number is never its withholding file
    expect(withholding({ company_tax_id: '514000009' })).toBeUndefined();
    expect(
      withholding({ company_tax_id: '514000009', tax_nikuim_pinkas_number: '951400001' }),
    ).toBe('951400001');
    // not a valid Israeli ID
    expect(withholding({ company_tax_id: '951400002' })).toBeUndefined();
    expect(withholding({ company_tax_id: null, tax_nikuim_pinkas_number: '951400001' })).toBe(
      '951400001',
    );
    // the profile override wins, as entered
    expect(withholding({ company_tax_id: '951400001' }, '951400019')).toBe('951400019');
  });

  it('lets profile company overrides win', () => {
    const { input, mappingIssues } = assemble({
      adminBusiness: { company_tax_id: '951400001' },
      profile: profile({
        company: {
          registeredName: 'שם אחר בע"מ',
          phone: { prefix: '054', number: '7654321' },
          fax: { prefix: '03', number: '7654321' },
          email: 'tax@example.com',
          occupationDescription: 'פיתוח תוכנה',
          mailingAddress: 'ת.ד. 1, חיפה',
          businessAddress: 'רחוב העצמאות 5, חיפה',
          booksAddress: 'משרד רואה החשבון',
          withholdingFileNumber: '951400002',
        },
      }),
    });
    expect(mappingIssues).toEqual([]);
    expect(input!.company).toEqual({
      fileNumber: '514000009',
      vatFileNumber: '514000009',
      registeredName: 'שם אחר בע"מ',
      phone: { prefix: '054', number: '7654321' },
      fax: { prefix: '03', number: '7654321' },
      email: 'tax@example.com',
      occupationDescription: 'פיתוח תוכנה',
      mailingAddress: 'ת.ד. 1, חיפה',
      businessAddress: 'רחוב העצמאות 5, חיפה',
      booksAddress: 'משרד רואה החשבון',
      withholdingFileNumber: '951400002',
    });
  });

  it('reports missing identity data without inventing it', () => {
    const { input, mappingIssues } = assemble({
      business: {
        ...business,
        vat_number: null,
        address: null,
        address_hebrew: null,
        city: null,
        zip_code: null,
        phone_number: null,
      },
    });
    expect(mappingIssues.map(issue => [issue.ruleId, issue.path, issue.severity])).toEqual([
      [REPORT_1214_MAPPING_RULES.fileNumberMissing, 'company.fileNumber', 'error'],
      [REPORT_1214_MAPPING_RULES.addressMissing, 'company.mailingAddress', 'error'],
      [REPORT_1214_MAPPING_RULES.addressMissing, 'company.businessAddress', 'error'],
      [REPORT_1214_MAPPING_RULES.phoneMissing, 'company.phone', 'error'],
    ]);
    expect(input!.company).not.toHaveProperty('fileNumber');
    expect(input!.company).not.toHaveProperty('phone');
    expect(input!.company).not.toHaveProperty('mailingAddress');
    // the best-effort input still validates; the generator's shape issues at the same paths
    const result = validate1214(input);
    expect(result.valid).toBe(false);
    expect(result.errors.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['input.shape', 'company.fileNumber'],
      ['input.shape', 'company.mailingAddress'],
      ['input.shape', 'company.businessAddress'],
      ['input.shape', 'company.phone'],
    ]);
    // ... are dropped from the report's issues, which name each missing item once
    const { errors, warnings } = collectReport1214Issues({ input, mappingIssues });
    expect(errors).toEqual(mappingIssues);
    expect(warnings).toEqual([]);
  });

  it('reports a business phone it cannot parse, and uses a profile phone instead', () => {
    const bad = assemble({ business: { ...business, phone_number: '+1 212 555 1234' } });
    expect(bad.mappingIssues).toMatchObject([
      { ruleId: REPORT_1214_MAPPING_RULES.phoneUnparsable, path: 'company.phone' },
    ]);
    expect(bad.mappingIssues[0].message).toContain('1214 profile');

    const fixed = assemble({
      business: { ...business, phone_number: '+1 212 555 1234' },
      profile: profile({ company: { phone: { prefix: '052', number: '1111111' } } }),
    });
    expect(fixed.mappingIssues).toEqual([]);
    expect(fixed.input!.company.phone).toEqual({ prefix: '052', number: '1111111' });
  });

  it('drops empty profile blocks and lists', () => {
    const { input, mappingIssues } = assemble();
    expect(mappingIssues).toEqual([]);
    for (const key of [
      'preparer',
      'attachments',
      'bankAccount',
      'otherTaxableIncome',
      'capitalGainsSummary',
      'qualifyingCompany',
      'relatedCompanies',
      'rdInvestments',
    ]) {
      expect(input).not.toHaveProperty(key);
    }
  });

  it('leaves out an incomplete bank account with a warning', () => {
    const { input, mappingIssues } = assemble({ profile: profile({ bankAccount: { bank: '12' } }) });
    expect(input).not.toHaveProperty('bankAccount');
    expect(mappingIssues).toEqual([
      expect.objectContaining({
        ruleId: REPORT_1214_MAPPING_RULES.bankAccountIncomplete,
        severity: 'warning',
        path: 'bankAccount',
      }),
    ]);
  });

  it('passes set profile blocks through', () => {
    const blocks = {
      preparer: { officeName: 'משרד רו"ח', phone: { prefix: '03' as const, number: '2222222' } },
      attachments: { donationReceiptsCount: 2 },
      bankAccount: { bank: '12', branch: '345', account: '678' },
      otherTaxableIncome: { source: 'ריבית', amount: 100 },
      capitalGainsSummary: { totalAppendicesCount: 1 },
      qualifyingCompany: { purchased: false },
      relatedCompanies: [{ companyName: 'חברת בת', relationType: 'subsidiary' as const }],
      rdInvestments: [{ companyName: 'מו"פ בע"מ', investmentAmount: 5000 }],
    };
    const { input, mappingIssues } = assemble({ profile: profile(blocks) });
    expect(mappingIssues).toEqual([]);
    expect(input).toMatchObject(blocks);
    // every block has the generator's input shape
    expect(ruleIds(validate1214(input).errors)).not.toContain('input.shape');
  });

  it('reports each unanswered required declaration and fills it with false', () => {
    const { input, mappingIssues } = assemble({
      profile: profile({
        declarations: { hasTaxPlanningAction: true, isHouseCompany: true, form6111Obligation: 'obliged' },
      }),
    });
    expect(mappingIssues.map(issue => issue.path)).toEqual([
      'declarations.hadRelatedPartyTransactions',
      'declarations.controlsBodyOfPersons',
      'declarations.holdsRightsInBodyOfPersons',
      'declarations.appliesAccountingStandards',
      'declarations.directorsReceivedOpinion',
      'declarations.tookReportablePosition',
    ]);
    expect(new Set(ruleIds(mappingIssues))).toEqual(
      new Set([REPORT_1214_MAPPING_RULES.declarationMissing]),
    );
    expect(mappingIssues.every(issue => issue.severity === 'error')).toBe(true);
    expect(mappingIssues[0].message).toMatch(/^Answer /);
    expect(input!.declarations).toEqual({
      ...completeDeclarations,
      hasTaxPlanningAction: true,
      isHouseCompany: true,
      form6111Obligation: 'obliged',
    });
  });

  it('drops amount overrides of derived codes with a warning', () => {
    const derived = getLayout(YEAR).records['1000'].codes.find(def => def.derived)!.code;
    const { input, mappingIssues } = assemble({
      profile: profile({
        amountOverrides: { '081': 1000, [derived]: 5 } as Report1214ProfileProto['amountOverrides'],
      }),
    });
    expect(input!.amounts).toEqual({ '081': 1000 });
    expect(mappingIssues).toEqual([
      expect.objectContaining({
        ruleId: REPORT_1214_MAPPING_RULES.derivedOverrideDropped,
        severity: 'warning',
        path: `amounts["${derived}"]`,
        code: derived,
      }),
    ]);
  });

  it('keeps an override of 0', () => {
    const { input } = assemble();
    expect(input!.amounts).toMatchObject({ '072': 0, '094': 0 });
  });

  it('lists the amounts as rows sorted by code, all overrides without computed values', () => {
    const { amounts } = assemble();
    expect(amounts).toEqual(
      ['018', '072', '081', '094', '263'].map(code => ({
        code,
        amount: profile().amountOverrides[code as '018'],
        source: 'OVERRIDE',
        computedAmount: null,
        label: null,
      })),
    );
  });

  it('computes code 165 from the R&D investments', () => {
    const { input, amounts, mappingIssues } = assemble({
      profile: profile({
        rdInvestments: [
          { companyName: 'חברה א', investmentAmount: 1000 },
          { companyName: 'חברה ב', investmentAmount: 2000 },
        ],
      }),
    });
    expect(mappingIssues).toEqual([]);
    expect(input!.amounts['165']).toBe(3000);
    expect(amounts.find(row => row.code === '165')).toEqual({
      code: '165',
      amount: 3000,
      source: 'COMPUTED',
      computedAmount: 3000,
      label: 'סך השקעות בחברות מו"פ',
    });
    const { errors, warnings } = validate1214(input);
    expect([...errors, ...warnings].map(issue => issue.ruleId)).not.toContain('main.rd.total');
  });

  it('lets an override beat the computed amount, and keeps the computed one alongside', () => {
    const rdInvestments = [{ companyName: 'חברה א', investmentAmount: 1000 }];
    for (const override of [1500, 0]) {
      const { input, amounts } = assemble({
        profile: profile({
          rdInvestments,
          amountOverrides: { ...profile().amountOverrides, '165': override },
        }),
      });
      expect(input!.amounts['165']).toBe(override);
      expect(amounts.find(row => row.code === '165')).toMatchObject({
        amount: override,
        source: 'OVERRIDE',
        computedAmount: 1000,
      });
    }
  });

  it('adds the issues of loading the books, and computes without them', () => {
    const issue = {
      ruleId: REPORT_1214_MAPPING_RULES.computationFailed,
      severity: 'warning' as const,
      path: 'amounts',
      message: 'failed',
    };
    const { input, mappingIssues } = assemble({
      profile: profile({ rdInvestments: [{ companyName: 'חברה א', investmentAmount: 7 }] }),
      taxData: { tax: null, issues: [issue] },
    });
    expect(mappingIssues).toEqual([issue]);
    expect(input!.amounts['165']).toBe(7);
  });

  it('computes the codes that need the books from the loaded books, under the overrides', () => {
    const tax = { taxAmounts: { taxableIncomeAmount: 4321.6 } } as unknown as AnnualTaxData;
    const codeSources: Report1214CodeSources = {
      ...CODE_SOURCES,
      '010': {
        label: 'בדיקה',
        specRef: 'p.0',
        requiresTaxData: true,
        compute: ({ tax }) => tax.taxAmounts.taxableIncomeAmount,
      },
      '011': {
        label: 'לא סופי',
        specRef: 'p.0',
        requiresTaxData: true,
        compute: () => Number.NaN,
      },
    };
    const loadIssue = {
      ruleId: 'accounter.test.loaded',
      severity: 'warning' as const,
      path: 'amounts',
      message: 'loaded',
    };

    const computed = assemble({ taxData: { tax, issues: [loadIssue] }, codeSources });
    expect(computed.input!.amounts['010']).toBe(4322);
    expect(computed.amounts.find(row => row.code === '010')).toEqual({
      code: '010',
      amount: 4322,
      source: 'COMPUTED',
      computedAmount: 4322,
      label: 'בדיקה',
    });
    expect(computed.mappingIssues).toEqual([
      loadIssue,
      expect.objectContaining({
        ruleId: REPORT_1214_MAPPING_RULES.computedInvalid,
        code: '011',
      }),
    ]);

    const overridden = assemble({
      taxData: { tax, issues: [] },
      codeSources,
      profile: profile({ amountOverrides: { ...profile().amountOverrides, '010': 5 } }),
    });
    expect(overridden.input!.amounts['010']).toBe(5);
    expect(overridden.amounts.find(row => row.code === '010')).toMatchObject({
      amount: 5,
      source: 'OVERRIDE',
      computedAmount: 4322,
    });

    // without the books, the code is not computed at all
    expect(assemble({ codeSources }).input!.amounts).not.toHaveProperty('010');
  });

  it('maps shareholders to the generator shape', () => {
    const { input } = assemble({
      shareholders: [
        shareholder({ dividendRightsPercent: 60, votingRightsPercent: 60, salaryMonths1To9: 9000 }),
        shareholder({
          id: 'sh-2',
          idNumber: '000000018',
          fullName: 'שרה כהן',
          isControllingShareholder: false,
          dividendRightsPercent: 40,
          isMaterialShareholder: true,
          businessId: '00000000-0000-0000-0000-0000000000bb',
        }),
      ],
    });
    expect(input!.shareholders).toEqual([
      {
        idNumber: '123456782',
        fullName: 'ישראל ישראלי',
        isControllingShareholder: true,
        dividendRightsPercent: 60,
        votingRightsPercent: 60,
        salaryMonths1To9: 9000,
      },
      {
        idNumber: '000000018',
        fullName: 'שרה כהן',
        isControllingShareholder: false,
        dividendRightsPercent: 40,
        isMaterialShareholder: true,
      },
    ]);
  });

  it('builds no input for a year the generator does not support', () => {
    const { input, mappingIssues, amounts } = assemble({ year: 2023 });
    expect(input).toBeNull();
    expect(amounts).toEqual([]);
    expect(mappingIssues).toMatchObject([
      { ruleId: REPORT_1214_MAPPING_RULES.taxYearUnsupported, severity: 'error', path: 'taxYear' },
    ]);
  });

  it('builds a complete report that validates and round-trips through the file', () => {
    const { input, mappingIssues } = assemble({
      adminBusiness: { company_tax_id: '951400001' },
      profile: profile({
        company: { occupationDescription: 'פיתוח תוכנה', fax: { prefix: '03', number: '7654321' } },
        preparer: { officeName: 'משרד רו"ח', phone: { prefix: '03', number: '2222222' } },
      }),
      shareholders: [
        shareholder({ dividendRightsPercent: 60, votingRightsPercent: 60 }),
        shareholder({
          id: 'sh-2',
          idNumber: '000000018',
          fullName: 'שרה כהן',
          isControllingShareholder: false,
          dividendRightsPercent: 40,
          votingRightsPercent: 40,
        }),
      ],
    });
    expect(mappingIssues).toEqual([]);
    const validation = validate1214(input);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);

    const generated = generate1214(input!, { today: () => '2025-03-31' });
    const { report } = parse1214(generated.bytes);
    const omitted = new Set(
      generated.summary.omittedZeroCodes
        .filter(entry => entry.record === '1000')
        .map(entry => entry.code),
    );
    const expectedAmounts = Object.fromEntries(
      Object.entries(input!.amounts).filter(([code]) => !omitted.has(code)),
    );
    expect(report.taxYear).toBe(input!.taxYear);
    expect(report.company).toEqual(input!.company);
    expect(report.preparer).toEqual(input!.preparer);
    expect(report.declarations).toEqual(input!.declarations);
    expect(report.amounts).toEqual(expectedAmounts);
    expect(report.shareholders).toEqual(input!.shareholders);
  });
});

describe('issueToGql', () => {
  it('maps a generator issue', () => {
    expect(
      issueToGql({
        ruleId: 'shareholders.dividendRights.total',
        severity: 'error',
        message: 'Dividend rights total 90, not 100',
        path: 'shareholders',
        recordType: '1020',
        recordIndex: 0,
        code: '081',
        specRef: { page: 22, note: 'total 100' },
      }),
    ).toEqual({
      ruleId: 'shareholders.dividendRights.total',
      severity: 'ERROR',
      message: 'Dividend rights total 90, not 100',
      path: 'shareholders',
      code: '081',
      recordType: '1020',
      recordIndex: 0,
      specRef: 'p.22: total 100',
    });
  });

  it('maps a report-level mapping warning', () => {
    expect(
      issueToGql({
        ruleId: 'accounter.amounts.derivedOverrideDropped',
        severity: 'warning',
        message: 'dropped',
        path: '',
      }),
    ).toEqual({
      ruleId: 'accounter.amounts.derivedOverrideDropped',
      severity: 'WARNING',
      message: 'dropped',
      path: null,
      code: null,
      recordType: null,
      recordIndex: null,
      specRef: null,
    });
    expect(
      issueToGql({ ruleId: 'x', severity: 'error', message: 'm', path: 'p', specRef: { page: 5 } })
        .specRef,
    ).toBe('p.5');
  });
});
