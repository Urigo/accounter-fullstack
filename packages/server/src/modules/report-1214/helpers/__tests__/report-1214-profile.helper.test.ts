import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';
import { getLayout, supportedTaxYears } from '@accounter/opcn1214-generator';
import type { Report1214ProfileInput } from '../../../../__generated__/types.js';
import type { IGetReport1214ProfilesByOwnerAndYearsResult } from '../../types.js';
import {
  amountOverrideCodes,
  amountOverridesToGql,
  bankAccountToGql,
  declarationsToGql,
  emptyToNull,
  form6111Obligation,
  mapReport1214ProfileRow,
  normalizeAmountOverrides,
  normalizePhone,
  normalizeReport1214ProfileInput,
  relatedCompaniesToGql,
  translateReport1214ProfileWriteError,
} from '../report-1214-profile.helper.js';

const YEAR = 2024;

function badUserInput(fn: () => unknown): GraphQLError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
    return error as GraphQLError;
  }
  throw new Error('expected a BAD_USER_INPUT error');
}

const normalize = (input: Report1214ProfileInput, year = YEAR) =>
  normalizeReport1214ProfileInput(input, year);

describe('normalizeReport1214ProfileInput', () => {
  it('keeps omitted blocks out of the patch and clears null blocks to {} / []', () => {
    expect(normalize({})).toEqual({});
    expect(
      normalize({
        company: null,
        declarations: null,
        preparer: null,
        attachments: null,
        bankAccount: null,
        otherTaxableIncome: null,
        capitalGainsSummary: null,
        qualifyingCompany: null,
        relatedCompanies: null,
        rdInvestments: null,
        amountOverrides: null,
      }),
    ).toEqual({
      company: {},
      declarations: {},
      preparer: {},
      attachments: {},
      bankAccount: {},
      otherTaxableIncome: {},
      capitalGainsSummary: {},
      qualifyingCompany: {},
      relatedCompanies: [],
      rdInvestments: [],
      amountOverrides: {},
    });
    const patch = normalize({ preparer: { name: 'Avi' } });
    expect(Object.keys(patch)).toEqual(['preparer']);
  });

  it('strips null and empty members, and trims strings', () => {
    expect(
      normalize({
        company: {
          registeredName: '  Acme Ltd ',
          email: '   ',
          mailingAddress: null,
          phone: { prefix: ' 03 ', number: '1234567 ' },
          fax: null,
          withholdingFileNumber: '951400001',
        },
        preparer: { officeName: '', name: 'Avi', phone: null, licensedDealerNumber: '12' },
        capitalGainsSummary: { totalAppendicesCount: 0, reasons: { other: null } },
      }),
    ).toEqual({
      company: {
        registeredName: 'Acme Ltd',
        phone: { prefix: '03', number: '1234567' },
        withholdingFileNumber: '951400001',
      },
      preparer: { name: 'Avi', licensedDealerNumber: '12' },
      capitalGainsSummary: { totalAppendicesCount: 0 },
    });
  });

  it('stores declarations in the generator shape, converting enums and leaving nulls out', () => {
    const { declarations } = normalize({
      declarations: {
        hasTaxPlanningAction: false,
        hadRelatedPartyTransactions: true,
        controlsBodyOfPersons: null,
        reportablePositions: [1, 999],
        form6111Obligation: 'NOT_OBLIGED',
        consolidatedReport: 'CONSOLIDATED_UNDER_SECTION_23',
        familyCompany: { representativeFileNumber: ' 123 ' },
        beneficiaryEnterprise: { noticeDate: '2024-05-01' },
        specialYear: null,
        isKibbutz: false,
      },
    });
    expect(declarations).toEqual({
      hasTaxPlanningAction: false,
      hadRelatedPartyTransactions: true,
      isKibbutz: false,
      reportablePositions: [1, 999],
      form6111Obligation: 'notObliged',
      consolidatedReport: 'consolidatedUnderSection23',
      familyCompany: { representativeFileNumber: '123' },
      beneficiaryEnterprise: { noticeDate: '2024-05-01' },
    });
  });

  it('round-trips declarations through declarationsToGql', () => {
    const { declarations } = normalize({
      declarations: { form6111Obligation: 'OBLIGED', consolidatedReport: 'NOT_RELEVANT' },
    });
    expect(declarationsToGql(declarations!)).toMatchObject({
      form6111Obligation: 'OBLIGED',
      consolidatedReport: 'NOT_RELEVANT',
      beneficiaryEnterprise: null,
      specialYear: null,
    });
    expect(form6111Obligation.toGql('bogus')).toBeNull();
  });

  it('rejects reportable positions out of 1-999', () => {
    badUserInput(() => normalize({ declarations: { reportablePositions: [0] } }));
    badUserInput(() => normalize({ declarations: { reportablePositions: [1000] } }));
  });

  it('stores more reportable positions than the form allows as is (the generator reports it)', () => {
    const positions = [1, 2, 3, 4, 5, 6];
    expect(
      normalize({ declarations: { reportablePositions: positions } }).declarations,
    ).toEqual({ reportablePositions: positions });
    expect(
      badUserInput(() =>
        normalize({
          declarations: { reportablePositions: Array.from({ length: 51 }, (_, i) => i + 1) },
        }),
      ).message,
    ).toMatch(/^declarations\.reportablePositions exceeds the size limit of 50 items/);
  });

  it('validates digit-only file numbers and the bank account', () => {
    expect(
      normalize({ bankAccount: { bank: '12', branch: '345', account: '000123' } }).bankAccount,
    ).toEqual({ bank: '12', branch: '345', account: '000123' });
    expect(
      badUserInput(() =>
        normalize({ bankAccount: { bank: '1', branch: '345', account: '1' } }),
      ).message,
    ).toMatch(/^bankAccount\.bank must be exactly 2 digits/);
    badUserInput(() => normalize({ bankAccount: { bank: '12', branch: '34', account: '1' } }));
    badUserInput(() => normalize({ bankAccount: { bank: '12', branch: '345', account: '' } }));
    badUserInput(() => normalize({ company: { withholdingFileNumber: '12-34' } }));
    badUserInput(() => normalize({ preparer: { licensedDealerNumber: '1234567890' } }));
    badUserInput(() =>
      normalize({ declarations: { familyCompany: { representativeFileNumber: 'x' } } }),
    );
  });

  it('rejects negative or fractional counts and over-long text', () => {
    badUserInput(() => normalize({ attachments: { donationReceiptsCount: -1 } }));
    badUserInput(() => normalize({ capitalGainsSummary: { untransmittedCount: 1.5 } }));
    expect(
      badUserInput(() => normalize({ company: { registeredName: 'x'.repeat(201) } })).message,
    ).toMatch(/^company\.registeredName must be at most 200 characters/);
  });

  it('converts related companies', () => {
    const { relatedCompanies } = normalize({
      relatedCompanies: [
        { companyName: ' Sub ', relationType: 'SUBSIDIARY', companyFileNumber: null },
        {
          companyName: 'Kib',
          relationType: 'KIBBUTZ_RELATED_CORPORATION',
          companyFileNumber: '12',
          assessingOfficeCode: 34,
        },
      ],
    });
    expect(relatedCompanies).toEqual([
      { companyName: 'Sub', relationType: 'subsidiary' },
      {
        companyName: 'Kib',
        relationType: 'kibbutzRelatedCorporation',
        companyFileNumber: '12',
        assessingOfficeCode: 34,
      },
    ]);
    expect(relatedCompaniesToGql(relatedCompanies!).map(c => c.relationType)).toEqual([
      'SUBSIDIARY',
      'KIBBUTZ_RELATED_CORPORATION',
    ]);

    const company = { companyName: 'X', relationType: 'OTHER' as const };
    badUserInput(() => normalize({ relatedCompanies: [{ ...company, companyName: ' ' }] }));
  });

  it('stores more related companies and R&D investments than the form allows as is', () => {
    const company = { companyName: 'X', relationType: 'OTHER' as const };
    expect(
      normalize({ relatedCompanies: Array.from({ length: 4 }, () => company) }).relatedCompanies,
    ).toEqual(Array.from({ length: 4 }, () => ({ companyName: 'X', relationType: 'other' })));
    const investment = { companyName: 'Lab', investmentAmount: 1000 };
    expect(
      normalize({ rdInvestments: Array.from({ length: 6 }, () => investment) }).rdInvestments,
    ).toEqual(Array.from({ length: 6 }, () => investment));
  });

  it('names list items by their 1-based position in messages', () => {
    expect(
      badUserInput(() => normalize({ declarations: { reportablePositions: [1, 2, 1000] } }))
        .message,
    ).toBe('Reportable position 3 must be an integer between 1 and 999 (got 1000)');
    expect(
      badUserInput(() =>
        normalize({ relatedCompanies: [{ companyName: '  ', relationType: 'OTHER' }] }),
      ).message,
    ).toBe('Related company 1: company name is required');
    expect(
      badUserInput(() =>
        normalize({
          relatedCompanies: [
            { companyName: 'A', relationType: 'OTHER' },
            { companyName: 'B', relationType: 'OTHER', companyFileNumber: '12a' },
          ],
        }),
      ).message,
    ).toMatch(/^Related company 2: company file number must be 1 to 9 digits/);
    expect(
      badUserInput(() =>
        normalize({
          rdInvestments: [
            { companyName: 'Lab', investmentAmount: 1 },
            { companyName: 'Lab', investmentAmount: Number.NaN },
          ],
        }),
      ).message,
    ).toBe('R&D investment 2: investment amount must be a finite number');
  });

  it('refuses lists over the 50-item size limit', () => {
    const company = { companyName: 'X', relationType: 'OTHER' as const };
    expect(
      badUserInput(() =>
        normalize({ relatedCompanies: Array.from({ length: 51 }, () => company) }),
      ).message,
    ).toMatch(/^relatedCompanies exceeds the size limit of 50 items \(got 51\)/);
    const investment = { companyName: 'Lab', investmentAmount: 1000 };
    expect(
      badUserInput(() => normalize({ rdInvestments: Array.from({ length: 51 }, () => investment) }))
        .message,
    ).toMatch(/^rdInvestments exceeds the size limit of 50 items/);
    expect(
      normalize({ rdInvestments: Array.from({ length: 50 }, () => investment) }).rdInvestments,
    ).toHaveLength(50);
  });
});

describe('normalizePhone', () => {
  it('accepts every allowed prefix with a 7-digit number', () => {
    for (const prefix of ['02', '03', '04', '08', '09', '050', '054', '059', '072', '077']) {
      expect(normalizePhone({ prefix, number: '1234567' }, 'p')).toEqual({
        prefix,
        number: '1234567',
      });
    }
    expect(normalizePhone(null, 'p')).toBeUndefined();
  });

  it('rejects an unknown prefix or a number that is not 7 digits', () => {
    expect(badUserInput(() => normalizePhone({ prefix: '051', number: '1234567' }, 'company.phone')).message).toMatch(
      /^company\.phone\.prefix must be one of/,
    );
    badUserInput(() => normalizePhone({ prefix: '3', number: '1234567' }, 'p'));
    expect(badUserInput(() => normalizePhone({ prefix: '03', number: '123456' }, 'company.fax')).message).toMatch(
      /^company\.fax\.number must be exactly 7 digits/,
    );
    badUserInput(() => normalizePhone({ prefix: '03', number: '123-4567' }, 'p'));
  });
});

describe('amount overrides', () => {
  it('derives the allowed codes from the layout of the year', () => {
    const { inputCodes, derivedCodes, layoutYear } = amountOverrideCodes(YEAR);
    expect(layoutYear).toBe(YEAR);
    const codes = getLayout(YEAR).records['1000'].codes;
    expect(inputCodes.size + derivedCodes.size).toBe(codes.length);
    expect(inputCodes.has('072')).toBe(true);
    expect(inputCodes.has('008')).toBe(false);
  });

  it('derives exactly the codes the generator computes (SPEC §7.4)', () => {
    for (const year of supportedTaxYears()) {
      expect([...amountOverrideCodes(year).derivedCodes].sort()).toEqual([
        '008',
        '028',
        '273',
        '277',
        '278',
        '280',
        '297',
      ]);
    }
  });

  it('accepts the enum codes 018 and 263', () => {
    expect(
      normalizeAmountOverrides(
        [
          { code: '018', amount: 4 },
          { code: '263', amount: 1 },
        ],
        YEAR,
      ),
    ).toEqual({ '018': 4, '263': 1 });
  });

  it('keeps an override of 0, which suppresses a code that does not allow zero', () => {
    expect(normalizeAmountOverrides([{ code: '072', amount: 0 }], YEAR)).toEqual({ '072': 0 });
    expect(amountOverridesToGql({ '072': 0 })).toEqual([{ code: '072', amount: 0 }]);
  });

  it('falls back to the latest supported layout for a year without one', () => {
    const latest = supportedTaxYears().at(-1);
    expect(amountOverrideCodes(2031).layoutYear).toBe(latest);
    expect(normalizeAmountOverrides([{ code: '072', amount: 5 }], 2031)).toEqual({ '072': 5 });
  });

  it('stores a { code: amount } map', () => {
    expect(
      normalize({
        amountOverrides: [
          { code: '072', amount: 1000 },
          { code: ' 081 ', amount: -12.5 },
        ],
      }).amountOverrides,
    ).toEqual({ '072': 1000, '081': -12.5 });
  });

  it('rejects a derived code', () => {
    expect(
      badUserInput(() => normalizeAmountOverrides([{ code: '008', amount: 1 }], YEAR)).message,
    ).toMatch(/^Amount override 1: code 008 is derived/);
  });

  it('rejects an unknown code', () => {
    expect(
      badUserInput(() => normalizeAmountOverrides([{ code: '999', amount: 1 }], YEAR)).message,
    ).toMatch(/is not a record 1000 input code of the 2024 layout/);
    badUserInput(() => normalizeAmountOverrides([{ code: '72', amount: 1 }], YEAR));
  });

  it('rejects a repeated code and a non-finite amount', () => {
    expect(
      badUserInput(() =>
        normalizeAmountOverrides(
          [
            { code: '072', amount: 1 },
            { code: '072', amount: 2 },
          ],
          YEAR,
        ),
      ).message,
    ).toMatch(/^Amount override 2: code 072 appears more than once/);
    badUserInput(() => normalizeAmountOverrides([{ code: '072', amount: Number.NaN }], YEAR));
    badUserInput(() =>
      normalizeAmountOverrides([{ code: '072', amount: Number.POSITIVE_INFINITY }], YEAR),
    );
  });

  it('lists stored overrides by code', () => {
    expect(amountOverridesToGql({ '081': 2, '072': 1 })).toEqual([
      { code: '072', amount: 1 },
      { code: '081', amount: 2 },
    ]);
  });
});

describe('mapReport1214ProfileRow', () => {
  it('returns empty defaults when no row exists', () => {
    const proto = mapReport1214ProfileRow(null, 'owner', YEAR);
    expect(proto).toEqual({
      ownerId: 'owner',
      year: YEAR,
      company: {},
      declarations: {},
      preparer: {},
      attachments: {},
      bankAccount: {},
      otherTaxableIncome: {},
      capitalGainsSummary: {},
      qualifyingCompany: {},
      relatedCompanies: [],
      rdInvestments: [],
      amountOverrides: {},
      updatedAt: null,
    });
    expect(emptyToNull(proto.preparer)).toBeNull();
    expect(bankAccountToGql(proto.bankAccount)).toBeNull();
  });

  it('passes the stored blocks through', () => {
    const updatedAt = new Date();
    const row = {
      owner_id: 'owner',
      year: YEAR,
      company: { email: 'a@b.c' },
      declarations: { isKibbutz: true },
      preparer: { name: 'Avi' },
      attachments: {},
      bank_account: { bank: '12', branch: '345', account: '1' },
      other_taxable_income: {},
      capital_gains_summary: {},
      qualifying_company: {},
      related_companies: [{ companyName: 'Sub', relationType: 'parent' }],
      rd_investments: [],
      amount_overrides: { '072': 1 },
      created_at: updatedAt,
      updated_at: updatedAt,
    } satisfies IGetReport1214ProfilesByOwnerAndYearsResult;
    const proto = mapReport1214ProfileRow(row, 'owner', YEAR);
    expect(proto).toMatchObject({
      company: { email: 'a@b.c' },
      declarations: { isKibbutz: true },
      preparer: { name: 'Avi' },
      relatedCompanies: [{ companyName: 'Sub', relationType: 'parent' }],
      amountOverrides: { '072': 1 },
      updatedAt,
    });
    expect(bankAccountToGql(proto.bankAccount)).toEqual({ bank: '12', branch: '345', account: '1' });
  });
});

describe('translateReport1214ProfileWriteError', () => {
  it('maps RLS and check violations, and passes other errors through', () => {
    const forbidden = translateReport1214ProfileWriteError({ code: '42501' }, 'o', YEAR);
    expect((forbidden as GraphQLError).extensions.code).toBe('FORBIDDEN');
    const check = translateReport1214ProfileWriteError({ code: '23514' }, 'o', YEAR);
    expect((check as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
    const other = new Error('boom');
    expect(translateReport1214ProfileWriteError(other, 'o', YEAR)).toBe(other);
  });
});
