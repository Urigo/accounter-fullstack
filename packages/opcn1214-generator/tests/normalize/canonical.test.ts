import type { PhonePrefix, Report1214Input } from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import { fullDeclarationsInput, fullMainInput, minimalInput } from '../fixtures/builders.js';

const TODAY = '2025-03-31';
const OPTIONS = { today: () => TODAY };

describe('canonicalize', () => {
  it('adds the written meta values to an otherwise canonical input', () => {
    expect(canonicalize(minimalInput(), OPTIONS)).toEqual({
      ...minimalInput(),
      meta: { softwareName: 'ACCOUNTER', saveDate: TODAY },
    });
  });

  it('keeps the given meta values (text normalized) and calls today only without a save date', () => {
    const today = vi.fn(() => TODAY);
    const input = minimalInput({
      meta: { softwareName: '  My\u00A0 Soft ', saveDate: '2025-01-02' },
    });
    expect(canonicalize(input, { today }).meta).toEqual({
      softwareName: 'My Soft',
      saveDate: '2025-01-02',
    });
    expect(today).not.toHaveBeenCalled();
  });

  it('normalizes text and removes empty optional text', () => {
    const { company } = canonicalize(
      minimalInput({
        company: {
          registeredName: '  חברה\u00A0\u00A0לדוגמה \u2013 בע\u201Dמ ',
          occupationDescription: '   ',
          email: '',
        },
      }),
      OPTIONS,
    );
    expect(company.registeredName).toBe('חברה לדוגמה - בע"מ');
    expect(company).not.toHaveProperty('occupationDescription');
    expect(company).not.toHaveProperty('email');
  });

  it('pads digit strings to the field width and removes all-zero optional ones', () => {
    const result = canonicalize(
      minimalInput({
        company: {
          fileNumber: '12345',
          withholdingFileNumber: '7',
          vatFileNumber: '000000000',
          fax: { prefix: '052', number: '12345' },
        },
        shareholders: [{ idNumber: '12', fullName: 'א', isControllingShareholder: true }],
      }),
      OPTIONS,
    );
    expect(result.company.fileNumber).toBe('000012345');
    expect(result.company.withholdingFileNumber).toBe('000000007');
    expect(result.company).not.toHaveProperty('vatFileNumber');
    expect(result.company.fax).toEqual({ prefix: '052', number: '0012345' });
    expect(result.shareholders[0]?.idNumber).toBe('000000012');
  });

  it('removes zero codes unless they are zeroAllowed', () => {
    const { amounts } = canonicalize(
      minimalInput({ amounts: { '010': 0, '080': 0, '070': 5 } }),
      OPTIONS,
    );
    expect(amounts).toEqual({
      '018': 4,
      '072': 0,
      '080': 0,
      '081': 1000,
      '094': 0,
      '263': 1,
      '070': 5,
    });
  });

  it('removes false flags and optional zero numbers, keeping required yes/no false', () => {
    const [shareholder] = canonicalize(
      minimalInput({
        shareholders: [
          {
            idNumber: '123456782',
            fullName: 'ישראל ישראלי',
            isControllingShareholder: false,
            dividendRightsPercent: 0,
            isMaterialShareholder: false,
            salaryMonths1To9: 0,
            otherPayments: 7,
          },
        ],
      }),
      OPTIONS,
    ).shareholders;
    expect(shareholder).toEqual({
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: false,
      otherPayments: 7,
    });
  });

  it('drops a phone prefix the normalizer drops', () => {
    const input = minimalInput({
      company: { fax: { prefix: '01' as PhonePrefix, number: '7654321' } },
    });
    expect(canonicalize(input, OPTIONS).company.fax).toEqual({ number: '7654321' });
  });

  it('rounds amounts like generation when rounding is halfUp', () => {
    const input = minimalInput({
      amounts: { '081': 1000.5, '010': 0.4 },
      shareholders: [
        {
          idNumber: '123456782',
          fullName: 'ישראל ישראלי',
          isControllingShareholder: true,
          salaryMonths1To9: 10.5,
        },
      ],
    });
    const result = canonicalize(input, { ...OPTIONS, rounding: 'halfUp' });
    expect(result.amounts['081']).toBe(1001);
    expect(result.amounts).not.toHaveProperty('010');
    expect(result.shareholders[0]?.salaryMonths1To9).toBe(11);
  });

  it('keeps every declaration and the preparer of the full declarations input', () => {
    const input = fullDeclarationsInput();
    const result = canonicalize(input, OPTIONS);
    expect(result.declarations).toEqual(input.declarations);
    expect(result.preparer).toEqual(input.preparer);
  });

  it('removes false flags, empty preparer members and an absent or false 833 override', () => {
    const result = canonicalize(
      minimalInput({
        preparer: { name: '  ', licensedDealerNumber: '000000000', phone: { number: '6543210' } },
        declarations: {
          isHouseCompany: false,
          noBankAccount: false,
          hasCapitalGainsAppendix: false,
          requestsAdvancePayments: false,
          reportablePositions: [],
        },
      }),
      OPTIONS,
    );
    expect(result.preparer).toEqual({ phone: { number: '6543210' } });
    expect(result.declarations).toEqual({
      ...minimalInput().declarations,
      requestsAdvancePayments: false,
    });
  });

  it('pads the digit strings of the preparer and the family company', () => {
    const result = canonicalize(
      minimalInput({
        preparer: { licensedDealerNumber: '1234' },
        declarations: { familyCompany: { representativeFileNumber: '77' } },
      }),
      OPTIONS,
    );
    expect(result.preparer?.licensedDealerNumber).toBe('000001234');
    expect(result.declarations.familyCompany).toEqual({ representativeFileNumber: '000000077' });
  });

  it('keeps a declaration object whose member is written as absent, as the parser reads it', () => {
    const result = canonicalize(
      minimalInput({ declarations: { familyCompany: { representativeFileNumber: '000000000' } } }),
      OPTIONS,
    );
    expect(result.declarations.familyCompany).toEqual({});
  });

  it('keeps only the first five reportable positions', () => {
    const result = canonicalize(
      minimalInput({ declarations: { reportablePositions: [1, 2, 3, 4, 5, 6] } }),
      OPTIONS,
    );
    expect(result.declarations.reportablePositions).toEqual([1, 2, 3, 4, 5]);
  });

  it('drops a preparer phone prefix the normalizer drops', () => {
    const input = minimalInput({
      preparer: { phone: { prefix: '01' as PhonePrefix, number: '7654321' } },
    });
    expect(canonicalize(input, OPTIONS).preparer).toEqual({ phone: { number: '7654321' } });
  });

  it('keeps every member of the full main input', () => {
    const input = fullMainInput();
    const result = canonicalize(input, OPTIONS);
    expect(result.otherTaxableIncome).toEqual(input.otherTaxableIncome);
    expect(result.attachments).toEqual(input.attachments);
    expect(result.capitalGainsSummary).toEqual(input.capitalGainsSummary);
    expect(result.qualifyingCompany).toEqual(input.qualifyingCompany);
    expect(result.declarations).toEqual(input.declarations);
    expect(result.bankAccount).toEqual(input.bankAccount);
  });

  describe('bank account (codes 277/278/280)', () => {
    it('pads the account to 9 digits, as 277 is read back', () => {
      const result = canonicalize(
        minimalInput({ bankAccount: { bank: '12', branch: '345', account: '678' } }),
        OPTIONS,
      );
      expect(result.bankAccount).toEqual({ bank: '12', branch: '345', account: '000000678' });
    });

    it('leaves no bankAccount without one', () => {
      expect(canonicalize(minimalInput(), OPTIONS)).not.toHaveProperty('bankAccount');
    });
  });

  it('never carries derived codes into amounts', () => {
    const input = minimalInput({
      declarations: { form6111Obligation: 'obliged', appliesAccountingStandards: true },
      capitalGainsSummary: { untransmittedCount: 2 },
      bankAccount: { bank: '12', branch: '345', account: '678' },
    });
    expect(canonicalize(input, OPTIONS).amounts).toEqual(minimalInput().amounts);
    expect(canonicalize(input, OPTIONS).declarations.form6111Obligation).toBe('obliged');
  });

  it('removes optional zero header numbers except the amountX 1091, and empty groups', () => {
    const result = canonicalize(
      minimalInput({
        otherTaxableIncome: { source: '  ', amount: 0, ratePercent: 0 },
        attachments: { donationReceiptsCount: 0, withholdingCertificatesCount: 0 },
        capitalGainsSummary: {
          totalAppendicesCount: 0,
          untransmittedCount: 0,
          reasons: { lossOrNoGain: false, other: false, otherText: '' },
        },
        qualifyingCompany: {
          purchased: false,
          israeliPurchaseAmount: 0,
          foreignPurchaseAmount: 0,
          amortizationClaimed: false,
          amortizationAmount: 0,
        },
      }),
      OPTIONS,
    );
    expect(result).not.toHaveProperty('otherTaxableIncome');
    expect(result).not.toHaveProperty('attachments');
    expect(result).not.toHaveProperty('capitalGainsSummary');
    expect(result.qualifyingCompany).toEqual({
      purchased: false,
      amortizationClaimed: false,
      amortizationAmount: 0,
    });
  });

  it('normalizes the text members and rounds the amounts like generation', () => {
    const result = canonicalize(
      minimalInput({
        otherTaxableIncome: { source: '  דמי\u00A0 שכירות ', amount: 10.5 },
        capitalGainsSummary: { reasons: { other: true, otherText: ' סיבה  אחרת ' } },
        qualifyingCompany: { israeliPurchaseAmount: 0.4, amortizationAmount: 0.4 },
      }),
      { ...OPTIONS, rounding: 'halfUp' },
    );
    expect(result.otherTaxableIncome).toEqual({ source: 'דמי שכירות', amount: 11 });
    expect(result.capitalGainsSummary).toEqual({
      reasons: { other: true, otherText: 'סיבה אחרת' },
    });
    expect(result.qualifyingCompany).toEqual({ amortizationAmount: 0 });
  });

  describe('833 has capital-gains appendix (SPEC §7.4)', () => {
    it('keeps hasCapitalGainsAppendix true when no untransmitted appendix explains 833 = yes', () => {
      for (const capitalGainsSummary of [undefined, { untransmittedCount: 0 }]) {
        const result = canonicalize(
          minimalInput({ declarations: { hasCapitalGainsAppendix: true }, capitalGainsSummary }),
          OPTIONS,
        );
        expect(result.declarations.hasCapitalGainsAppendix).toBe(true);
      }
    });

    it.each([true, false])(
      'drops hasCapitalGainsAppendix %s when untransmittedCount > 0 already makes 833 = yes',
      hasCapitalGainsAppendix => {
        const result = canonicalize(
          minimalInput({
            declarations: { hasCapitalGainsAppendix },
            capitalGainsSummary: { untransmittedCount: 2 },
          }),
          OPTIONS,
        );
        expect(result.declarations).not.toHaveProperty('hasCapitalGainsAppendix');
        expect(result.capitalGainsSummary).toEqual({ untransmittedCount: 2 });
      },
    );
  });

  it('does not change its input', () => {
    const input: Report1214Input = minimalInput({ company: { fileNumber: '12' } });
    const copy = structuredClone(input);
    canonicalize(input, OPTIONS);
    expect(input).toEqual(copy);
  });
});
