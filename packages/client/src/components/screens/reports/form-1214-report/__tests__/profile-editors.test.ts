import { describe, expect, it } from 'vitest';
import { Report1214RelatedCompanyRelationType } from '../../../../../gql/graphql.js';
import {
  addAmountOverrideDraft,
  amountEditorRows,
  amountOverrideDraftsFromProfile,
  buildAmountOverridesInput,
  newOverrideCodeError,
  overrideAmountError,
} from '../editors/amount-overrides.js';
import { parseOptionalNumber } from '../editors/form-values.js';
import {
  OTHER_DETAILS_BLOCKS,
  otherDetailsBlockToInput,
  otherDetailsFieldErrors,
  otherDetailsValuesFromBlock,
  type OtherDetailsBlockKey,
} from '../editors/other-details.js';
import {
  emptyRdInvestmentRow,
  rdInvestmentRowsFromProfile,
  rdInvestmentRowsToInput,
  rdInvestmentsTotal,
  validateRdInvestmentRow,
} from '../editors/rd-investments.js';
import {
  emptyRelatedCompanyRow,
  RELATION_TYPE_LABELS,
  RELATION_TYPES,
  relatedCompanyRowsFromProfile,
  relatedCompanyRowsToInput,
  validateRelatedCompanyRow,
} from '../editors/related-companies.js';

const block = (key: OtherDetailsBlockKey) => OTHER_DETAILS_BLOCKS.find(b => b.key === key)!;

describe('parseOptionalNumber', () => {
  it('reads blanks as null, numbers (with thousands separators) as numbers, the rest as invalid', () => {
    expect(parseOptionalNumber('  ')).toBeNull();
    expect(parseOptionalNumber('0')).toBe(0);
    expect(parseOptionalNumber('1,234.5')).toBe(1234.5);
    expect(parseOptionalNumber('-7')).toBe(-7);
    expect(parseOptionalNumber('abc')).toBeUndefined();
  });
});

describe('related companies', () => {
  it('labels every relation type', () => {
    expect(RELATION_TYPES).toHaveLength(Object.keys(Report1214RelatedCompanyRelationType).length);
    for (const type of Object.values(Report1214RelatedCompanyRelationType)) {
      expect(RELATION_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it('round-trips stored companies, with unique row ids', () => {
    const stored = [
      {
        companyName: 'חברה בת',
        companyFileNumber: '513000000',
        relationType: Report1214RelatedCompanyRelationType.Subsidiary,
        assessingOfficeCode: 34,
      },
      {
        companyName: 'Parent Inc',
        companyFileNumber: null,
        relationType: Report1214RelatedCompanyRelationType.Parent,
        assessingOfficeCode: null,
      },
    ];
    const rows = relatedCompanyRowsFromProfile(stored);
    expect(new Set(rows.map(row => row.rowId)).size).toBe(2);
    expect(relatedCompanyRowsToInput(rows)).toEqual({ ok: true, value: stored });
  });

  it('keeps rows past the form limit and sends an empty list to clear', () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      ...emptyRelatedCompanyRow(),
      companyName: ` Company ${index} `,
      relationType: Report1214RelatedCompanyRelationType.Other,
    }));
    const result = relatedCompanyRowsToInput(rows);
    expect(result.ok && result.value).toHaveLength(4);
    expect(result.ok && result.value[0]).toEqual({
      companyName: 'Company 0',
      companyFileNumber: null,
      relationType: 'OTHER',
      assessingOfficeCode: null,
    });
    expect(relatedCompanyRowsToInput([])).toEqual({ ok: true, value: [] });
  });

  it('names the row and field of an invalid row', () => {
    const valid = {
      ...emptyRelatedCompanyRow(),
      companyName: 'A',
      relationType: Report1214RelatedCompanyRelationType.Parent,
    };
    expect(relatedCompanyRowsToInput([valid, { ...valid, companyName: ' ' }])).toEqual({
      ok: false,
      error: 'Related company 2: Enter the company name',
    });
    expect(relatedCompanyRowsToInput([{ ...valid, relationType: '' }])).toEqual({
      ok: false,
      error: 'Related company 1: Choose the relation type',
    });
    expect(relatedCompanyRowsToInput([{ ...valid, companyFileNumber: '12a' }])).toMatchObject({
      ok: false,
    });
    expect(relatedCompanyRowsToInput([{ ...valid, assessingOfficeCode: '1.5' }])).toMatchObject({
      ok: false,
    });
  });
});

describe('row validation', () => {
  it('reports each invalid field of a related company', () => {
    expect(
      validateRelatedCompanyRow({
        ...emptyRelatedCompanyRow(),
        companyFileNumber: '1234567890',
        assessingOfficeCode: '-1',
      }),
    ).toEqual({
      companyName: 'Enter the company name',
      relationType: 'Choose the relation type',
      companyFileNumber: 'The file number is 1 to 9 digits',
      assessingOfficeCode: 'The assessing office code is a whole number, 0 or more',
    });
  });

  it('accepts a negative R&D amount (the server allows any finite amount)', () => {
    expect(
      validateRdInvestmentRow({
        ...emptyRdInvestmentRow(),
        companyName: 'A',
        investmentAmount: '-250',
      }),
    ).toEqual({});
  });
});

describe('R&D investments', () => {
  it('round-trips stored investments', () => {
    const stored = [
      { companyName: 'מו"פ בע"מ', companyFileNumber: '1', investmentAmount: 1000.4 },
      { companyName: 'B', companyFileNumber: null, investmentAmount: 0 },
    ];
    expect(rdInvestmentRowsToInput(rdInvestmentRowsFromProfile(stored))).toEqual({
      ok: true,
      value: stored,
    });
  });

  it('totals the amounts rounded to whole shekels, as code 165 is computed', () => {
    const rows = [
      { ...emptyRdInvestmentRow(), investmentAmount: '1000.4' },
      { ...emptyRdInvestmentRow(), investmentAmount: '1,000.5' },
      { ...emptyRdInvestmentRow(), investmentAmount: '' },
    ];
    expect(rdInvestmentsTotal(rows)).toBe(2001);
  });

  it('requires a name and an amount', () => {
    expect(rdInvestmentRowsToInput([{ ...emptyRdInvestmentRow(), companyName: 'A' }])).toEqual({
      ok: false,
      error: 'R&D investment 1: Enter the investment amount as a number',
    });
    expect(
      rdInvestmentRowsToInput([{ ...emptyRdInvestmentRow(), investmentAmount: '5' }]),
    ).toEqual({ ok: false, error: 'R&D investment 1: Enter the company name' });
  });
});

describe('amount overrides', () => {
  const amounts = [
    { code: '165', label: 'R&D total', computedAmount: 2001 },
    { code: '018', label: 'Income', computedAmount: 500 },
  ];

  it('merges computed codes with the overrides, sorted by code, with 165 read-only', () => {
    const drafts = amountOverrideDraftsFromProfile([
      { code: '263', amount: 7 },
      { code: '018', amount: 0 },
    ]);
    expect(amountEditorRows(amounts, drafts)).toEqual([
      { code: '018', label: 'Income', computedAmount: 500, override: '0', readOnly: false },
      { code: '165', label: 'R&D total', computedAmount: 2001, override: undefined, readOnly: true },
      { code: '263', label: null, computedAmount: null, override: '7', readOnly: false },
    ]);
  });

  it('builds the list from the overrides only, keeping 0', () => {
    const drafts = addAmountOverrideDraft(
      amountOverrideDraftsFromProfile([{ code: '263', amount: 7 }]),
      ' 018 ',
      '0',
    );
    expect(buildAmountOverridesInput(drafts)).toEqual({
      ok: true,
      value: [
        { code: '018', amount: 0 },
        { code: '263', amount: 7 },
      ],
    });
    expect(buildAmountOverridesInput([])).toEqual({ ok: true, value: [] });
  });

  it('refuses a blank override amount', () => {
    expect(buildAmountOverridesInput([{ code: '018', amount: ' ' }])).toEqual({
      ok: false,
      error: 'Code 018: Enter the amount as a number, or remove the override',
    });
  });

  it('checks a new code locally only for shape, 165 and duplicates', () => {
    const drafts = [{ code: '018', amount: '1' }];
    expect(newOverrideCodeError('18', drafts)).toMatch(/3 digits/);
    expect(newOverrideCodeError('165', drafts)).toMatch(/R&D investments/);
    expect(newOverrideCodeError('018', drafts)).toBe('Code 018 already has an override');
    // Unknown and derived codes are the server's to refuse
    expect(newOverrideCodeError('999', drafts)).toBeNull();
  });

  it('accepts negative and zero override amounts', () => {
    expect(overrideAmountError('-12.5')).toBeNull();
    expect(overrideAmountError('0')).toBeNull();
    expect(overrideAmountError('')).toBe('Enter the amount as a number, or remove the override');
  });
});

describe('other details', () => {
  it('round-trips a stored block, nested members included', () => {
    const summary = block('capitalGainsSummary');
    const stored = {
      totalAppendicesCount: 3,
      untransmittedCount: 1,
      reasons: { other: true, otherText: 'סיבה' },
    };
    const values = otherDetailsValuesFromBlock(summary, stored);
    expect(values['reasons.other']).toBe('true');
    expect(values['reasons.lossOrNoGain']).toBe('');
    expect(otherDetailsBlockToInput(summary, values)).toEqual({ ok: true, value: stored });
  });

  it('keeps yes/no answers, both yes and no', () => {
    const qualifying = block('qualifyingCompany');
    const values = otherDetailsValuesFromBlock(qualifying, {
      purchased: false,
      amortizationClaimed: true,
      amortizationAmount: 0,
    });
    expect(otherDetailsBlockToInput(qualifying, values)).toEqual({
      ok: true,
      value: { purchased: false, amortizationClaimed: true, amortizationAmount: 0 },
    });
  });

  it('clears a block with nothing set', () => {
    const attachments = block('attachments');
    expect(
      otherDetailsBlockToInput(attachments, otherDetailsValuesFromBlock(attachments, null)),
    ).toEqual({ ok: true, value: null });
  });

  it('needs the whole bank account, with the right number of digits', () => {
    const bank = block('bankAccount');
    expect(
      otherDetailsBlockToInput(bank, { bank: '12', branch: '345', account: '678' }),
    ).toEqual({ ok: true, value: { bank: '12', branch: '345', account: '678' } });
    expect(otherDetailsBlockToInput(bank, { bank: '12', branch: '', account: '' })).toMatchObject({
      ok: false,
    });
    expect(
      otherDetailsBlockToInput(bank, { bank: '1', branch: '345', account: '678' }),
    ).toEqual({ ok: false, error: 'Changed bank account: Bank: Enter 2 digits' });
  });

  it('marks the blank bank account fields once one is filled in', () => {
    expect(
      otherDetailsFieldErrors(block('bankAccount'), { bank: '12', branch: '', account: 'x' }),
    ).toEqual({
      branch: 'Required with the rest of the changed bank account, or clear them all',
      account: 'Enter 1 to 9 digits',
    });
    expect(
      otherDetailsFieldErrors(block('bankAccount'), { bank: '', branch: '', account: '' }),
    ).toEqual({});
  });

  it('accepts negative amounts but not negative counts', () => {
    expect(
      otherDetailsFieldErrors(block('otherTaxableIncome'), {
        source: '',
        amount: '-100',
        ratePercent: '',
      }),
    ).toEqual({});
    expect(
      otherDetailsFieldErrors(block('capitalGainsSummary'), { totalAppendicesCount: '-1' }),
    ).toEqual({ totalAppendicesCount: 'Enter a whole number, 0 or more' });
  });

  it('refuses a count that is not a whole number', () => {
    expect(
      otherDetailsBlockToInput(block('attachments'), {
        donationReceiptsCount: '2.5',
        withholdingCertificatesCount: '',
      }),
    ).toEqual({
      ok: false,
      error: 'Attachments: Donation receipts (code 070): Enter a whole number, 0 or more',
    });
  });
});
