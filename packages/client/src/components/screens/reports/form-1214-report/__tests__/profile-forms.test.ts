import { describe, expect, it } from 'vitest';
import {
  Report1214ConsolidatedReport,
  Report1214Form6111Obligation,
} from '../../../../../gql/graphql.js';
import {
  booleanToTriState,
  companyFormSchema,
  companyFormToInput,
  companyToForm,
  declarationsFormSchema,
  declarationsFormToInput,
  declarationsToForm,
  emptyToNull,
  OPTIONAL_FLAG_DECLARATIONS,
  OPTIONAL_YES_NO_DECLARATIONS,
  phoneFormToInput,
  preparerFormSchema,
  preparerFormToInput,
  preparerToForm,
  REQUIRED_DECLARATIONS,
  reportablePositionsFromForm,
  triStateToBoolean,
} from '../profile-forms.js';

describe('emptyToNull', () => {
  it('trims, and turns empty or blank text into null', () => {
    expect(emptyToNull('  a  ')).toBe('a');
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
  });
});

describe('phoneFormToInput', () => {
  it('is null when both parts are empty', () => {
    expect(phoneFormToInput({ prefix: '', number: ' ' })).toBeNull();
  });
  it('keeps both parts, trimmed, once either is set', () => {
    expect(phoneFormToInput({ prefix: '03', number: ' 1234567 ' })).toEqual({
      prefix: '03',
      number: '1234567',
    });
    expect(phoneFormToInput({ prefix: '', number: '1234567' })).toEqual({
      prefix: '',
      number: '1234567',
    });
  });
});

describe('company form', () => {
  it('reads an empty block back as an empty form, and saves it as null', () => {
    const form = companyToForm(null);
    expect(form.registeredName).toBe('');
    expect(form.phone).toEqual({ prefix: '', number: '' });
    expect(companyFormToInput(form)).toBeNull();
  });

  it('round-trips the set overrides and leaves out the empty ones', () => {
    const form = companyToForm({
      registeredName: 'חברה בע"מ',
      phone: { prefix: '054', number: '1234567' },
      fax: null,
      email: 'a@b.co',
      mailingAddress: null,
      withholdingFileNumber: '123',
    });
    expect(form.mailingAddress).toBe('');
    expect(companyFormToInput({ ...form, booksAddress: '  ' })).toEqual({
      registeredName: 'חברה בע"מ',
      phone: { prefix: '054', number: '1234567' },
      email: 'a@b.co',
      withholdingFileNumber: '123',
    });
  });

  it('checks phones and digits, and leaves the email to the report validation', () => {
    const valid = companyToForm({ phone: { prefix: '03', number: '1234567' } });
    expect(companyFormSchema.safeParse(valid).success).toBe(true);

    const result = companyFormSchema.safeParse({
      ...valid,
      phone: { prefix: '01', number: '123' },
      withholdingFileNumber: '12a',
      email: 'nope',
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map(issue => issue.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['phone.prefix', 'phone.number', 'withholdingFileNumber']),
    );
    expect(paths).not.toContain('email');
  });
});

describe('preparer form', () => {
  it('sends null when every field is empty', () => {
    expect(preparerFormToInput(preparerToForm(undefined))).toBeNull();
  });

  it('sends the whole block with only the set fields', () => {
    const form = preparerToForm({ officeName: 'Office', phone: { prefix: '02', number: '7654321' } });
    expect(preparerFormToInput({ ...form, licensedDealerNumber: '123456789' })).toEqual({
      officeName: 'Office',
      licensedDealerNumber: '123456789',
      phone: { prefix: '02', number: '7654321' },
    });
  });

  it('requires the licensed dealer number to be up to 9 digits', () => {
    const form = { ...preparerToForm(null), licensedDealerNumber: '1234567890' };
    expect(preparerFormSchema.safeParse(form).success).toBe(false);
  });
});

describe('tri-state', () => {
  it('maps booleans both ways, with unset as an empty answer', () => {
    expect(booleanToTriState(true)).toBe('yes');
    expect(booleanToTriState(false)).toBe('no');
    expect(booleanToTriState(null)).toBe('');
    expect(triStateToBoolean('yes')).toBe(true);
    expect(triStateToBoolean('no')).toBe(false);
    expect(triStateToBoolean('')).toBeNull();
  });
});

describe('declarations form', () => {
  it('covers every declaration once', () => {
    const keys = [
      ...REQUIRED_DECLARATIONS,
      ...OPTIONAL_YES_NO_DECLARATIONS,
      ...OPTIONAL_FLAG_DECLARATIONS,
    ].map(item => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(REQUIRED_DECLARATIONS).toHaveLength(7);
  });

  it('reads an empty block as unanswered, and saves an untouched form as null', () => {
    const form = declarationsToForm(null);
    expect(form.answers.hasTaxPlanningAction).toBe('');
    expect(form.flags.isKibbutz).toBe(false);
    expect(form.isFamilyCompany).toBe(false);
    expect(form.reportablePositions).toEqual([]);
    expect(declarationsFormToInput(form)).toBeNull();
  });

  it('round-trips a full block', () => {
    const block = {
      hasTaxPlanningAction: false,
      hadRelatedPartyTransactions: true,
      controlsBodyOfPersons: false,
      holdsRightsInBodyOfPersons: false,
      appliesAccountingStandards: true,
      directorsReceivedOpinion: false,
      tookReportablePosition: true,
      requestsAdvancePayments: false,
      isHouseCompany: true,
      form6111Obligation: Report1214Form6111Obligation.Obliged,
      consolidatedReport: Report1214ConsolidatedReport.NotRelevant,
      familyCompany: { representativeFileNumber: '12345' },
      beneficiaryEnterprise: { noticeDate: '2024-03-01' as const },
      specialYear: { balanceSheetDate: '2024-06-30' as const },
      reportablePositions: [3, 17],
    };
    expect(declarationsFormToInput(declarationsToForm(block))).toEqual(block);
  });

  it('drops unmarked flags, unanswered questions and nested blocks whose toggle is off', () => {
    const form = declarationsToForm({
      isKibbutz: false,
      partOfMultinationalGroup: null,
      familyCompany: { representativeFileNumber: '1' },
    });
    expect(form.flags.isKibbutz).toBe(false);
    expect(
      declarationsFormToInput({
        ...form,
        answers: { ...form.answers, hasTaxPlanningAction: 'no' },
        isFamilyCompany: false,
      }),
    ).toEqual({ hasTaxPlanningAction: false });
  });

  it('reads reportable positions, skipping blank rows', () => {
    expect(
      reportablePositionsFromForm([{ value: ' 5 ' }, { value: '' }, { value: '999' }]),
    ).toEqual([5, 999]);
  });

  it('allows more reportable positions than the form holds', () => {
    const form = declarationsToForm({
      tookReportablePosition: true,
      reportablePositions: [1, 2, 3, 4, 5, 6],
    });
    expect(declarationsFormSchema.safeParse(form).success).toBe(true);
    expect(declarationsFormToInput(form)?.reportablePositions).toHaveLength(6);
  });

  it('checks positions, the representative file number and the nested dates', () => {
    const empty = declarationsToForm(null);
    const form = {
      ...empty,
      answers: { ...empty.answers, tookReportablePosition: 'yes' as const },
      isFamilyCompany: true,
      representativeFileNumber: '',
      isBeneficiaryEnterprise: true,
      beneficiaryNoticeDate: '',
      isSpecialYear: true,
      specialYearBalanceSheetDate: '2024-1-1',
      reportablePositions: [{ value: '0' }, { value: '1000' }, { value: '2.5' }, { value: '' }],
    };
    const result = declarationsFormSchema.safeParse(form);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.path.join('.')).sort()).toEqual([
      'beneficiaryNoticeDate',
      'reportablePositions.0.value',
      'reportablePositions.1.value',
      'reportablePositions.2.value',
      'representativeFileNumber',
      'specialYearBalanceSheetDate',
    ]);
  });

  it('saves reportable positions only while 1030 is answered yes', () => {
    const form = declarationsToForm({ tookReportablePosition: true, reportablePositions: [3, 17] });
    const withAnswer = (answer: 'yes' | 'no' | '') => ({
      ...form,
      answers: { ...form.answers, tookReportablePosition: answer },
    });
    expect(declarationsFormToInput(withAnswer('yes'))).toEqual({
      tookReportablePosition: true,
      reportablePositions: [3, 17],
    });
    expect(declarationsFormToInput(withAnswer('no'))).toEqual({ tookReportablePosition: false });
    expect(declarationsFormToInput(withAnswer(''))).toBeNull();
  });

  it('does not check reportable positions while 1030 is not answered yes', () => {
    const form = { ...declarationsToForm(null), reportablePositions: [{ value: '1000' }] };
    expect(declarationsFormSchema.safeParse(form).success).toBe(true);
    expect(
      declarationsFormSchema.safeParse({
        ...form,
        answers: { ...form.answers, tookReportablePosition: 'no' },
      }).success,
    ).toBe(true);
    expect(
      declarationsFormSchema.safeParse({
        ...form,
        answers: { ...form.answers, tookReportablePosition: 'yes' },
      }).success,
    ).toBe(false);
  });
});
