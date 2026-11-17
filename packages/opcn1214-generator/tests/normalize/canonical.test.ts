import type { CountryCode, PhonePrefix, Report1214Input } from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import {
  foreignAppendix,
  foreignAppendixWithBreakdown,
  fullDeclarationsInput,
  fullMainInput,
  minimalInput,
  rdInvestments,
  relatedCompanies,
  section6Appendices,
  section6Appendix,
} from '../fixtures/builders.js';

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

  it.each(['', '   ', '\u00A0'])(
    'writes the default software name for a name that normalizes to %j',
    softwareName => {
      expect(canonicalize(minimalInput({ meta: { softwareName } }), OPTIONS).meta).toEqual({
        softwareName: 'ACCOUNTER',
        saveDate: TODAY,
      });
    },
  );

  it('keeps ×100 values in hundredths, without float residue', () => {
    const shareholder = {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 0.1 + 0.2,
      votingRightsPercent: 1.1 + 2.2,
      otherRightsPercent: 100,
    };
    const [result] = canonicalize(
      minimalInput({ shareholders: [shareholder] }),
      OPTIONS,
    ).shareholders;
    expect(result).toMatchObject({
      dividendRightsPercent: 0.3,
      votingRightsPercent: 3.3,
      otherRightsPercent: 100,
    });
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

  describe('related companies (records 1010)', () => {
    it('keeps related companies, in input order', () => {
      const companies = relatedCompanies(3);
      expect(canonicalize(minimalInput({ relatedCompanies: companies }), OPTIONS)).toEqual({
        ...minimalInput({ relatedCompanies: companies }),
        meta: { softwareName: 'ACCOUNTER', saveDate: TODAY },
      });
    });

    it('normalizes the name, pads the file number and removes members written as absent', () => {
      const result = canonicalize(
        minimalInput({
          relatedCompanies: [
            {
              companyName: '  חברה\u00A0 קשורה ',
              companyFileNumber: '12',
              relationType: 'grandmother',
              assessingOfficeCode: 0,
            },
            { companyName: 'B', companyFileNumber: '000000000', relationType: 'other' },
          ],
        }),
        OPTIONS,
      );
      expect(result.relatedCompanies).toEqual([
        { companyName: 'חברה קשורה', companyFileNumber: '000000012', relationType: 'grandmother' },
        { companyName: 'B', relationType: 'other' },
      ]);
    });

    it('removes an empty list, as the parser reads a report without 1010 records', () => {
      expect(canonicalize(minimalInput({ relatedCompanies: [] }), OPTIONS)).not.toHaveProperty(
        'relatedCompanies',
      );
    });
  });

  describe('R&D investments (records 1030)', () => {
    it('keeps R&D investments, in input order', () => {
      const investments = rdInvestments(5);
      expect(canonicalize(minimalInput({ rdInvestments: investments }), OPTIONS)).toEqual({
        ...minimalInput({ rdInvestments: investments }),
        meta: { softwareName: 'ACCOUNTER', saveDate: TODAY },
      });
    });

    it('normalizes the name, pads the file number, rounds the amount and keeps an amount of 0', () => {
      const result = canonicalize(
        minimalInput({
          rdInvestments: [
            { companyName: '  חברת\u00A0 מו"פ ', companyFileNumber: '12', investmentAmount: 99.5 },
            { companyName: 'B', companyFileNumber: '000000000', investmentAmount: 0 },
          ],
        }),
        { ...OPTIONS, rounding: 'halfUp' },
      );
      expect(result.rdInvestments).toEqual([
        { companyName: 'חברת מו"פ', companyFileNumber: '000000012', investmentAmount: 100 },
        { companyName: 'B', investmentAmount: 0 },
      ]);
    });

    it('removes an empty list, as the parser reads a report without 1030 records', () => {
      expect(canonicalize(minimalInput({ rdInvestments: [] }), OPTIONS)).not.toHaveProperty(
        'rdInvestments',
      );
    });
  });

  describe('foreign appendix (record 2000)', () => {
    it('keeps a canonical foreign appendix as it is', () => {
      const input = minimalInput({ foreignAppendix: foreignAppendix({ amounts: { '442': 0 } }) });
      expect(canonicalize(input, OPTIONS)).toEqual({
        ...input,
        meta: { softwareName: 'ACCOUNTER', saveDate: TODAY },
      });
    });

    it('normalizes the description, rounds, drops zero header amounts and non-zeroAllowed zero codes', () => {
      const result = canonicalize(
        minimalInput({
          foreignAppendix: {
            otherTaxableIncomeDescription: '  תמלוגים\u00A0 מחו"ל ',
            otherTaxableIncome: 99.5,
            totalForeignLoss: 0,
            taxRefundDeclaration: false,
            taxRefundDeclarationAmount: 0,
            amounts: { '401': 0, '420': 0.4, '442': 0, '425': 2.5 },
          },
        }),
        { ...OPTIONS, rounding: 'halfUp' },
      );
      expect(result.foreignAppendix).toEqual({
        otherTaxableIncomeDescription: 'תמלוגים מחו"ל',
        otherTaxableIncome: 100,
        taxRefundDeclaration: false,
        amounts: { '425': 3, '442': 0 },
      });
    });

    it('keeps a canonical country breakdown as it is', () => {
      const input = minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') });
      expect(canonicalize(input, OPTIONS).foreignAppendix).toEqual(input.foreignAppendix);
    });

    it('pads country codes, rounds, drops zero deductions and keeps incomes of 0', () => {
      const result = canonicalize(
        minimalInput({
          foreignAppendix: foreignAppendix({
            amounts: { '420': 1, '439': 1 },
            countryBreakdown: {
              '420': {
                deductionsOffsetsAndExemptions: 0,
                countries: [
                  { country: '40' as CountryCode, income: 2.5 },
                  { country: '840', income: 0 },
                ],
              },
              '439': {
                deductionsOffsetsAndExemptions: 0.4,
                countries: [{ country: '-88', income: 1 }],
              },
            },
          }),
        }),
        { ...OPTIONS, rounding: 'halfUp' },
      );
      expect(result.foreignAppendix?.countryBreakdown).toEqual({
        '420': {
          countries: [
            { country: '040', income: 3 },
            { country: '840', income: 0 },
          ],
        },
        '439': { countries: [{ country: '-88', income: 1 }] },
      });
    });

    it('removes an empty countryBreakdown and undefined breakdowns', () => {
      for (const countryBreakdown of [{}, { '420': undefined }]) {
        const input = minimalInput({ foreignAppendix: { ...foreignAppendix(), countryBreakdown } });
        expect(canonicalize(input, OPTIONS).foreignAppendix).not.toHaveProperty('countryBreakdown');
      }
    });

    it('leaves no foreignAppendix when the input has none', () => {
      expect(canonicalize(minimalInput(), OPTIONS)).not.toHaveProperty('foreignAppendix');
    });
  });

  describe('capital-gains appendices (records 30xx)', () => {
    it('keeps canonical appendices as they are, in input order within a type', () => {
      const appendices = section6Appendices(3);
      expect(
        canonicalize(minimalInput({ capitalGains: appendices }), OPTIONS).capitalGains,
      ).toEqual(appendices);
    });

    it('rounds, drops zero header amounts and zero codes, keeps a "no" foreign asset', () => {
      const result = canonicalize(
        minimalInput({
          capitalGains: [
            { symbol: 63, foreignAsset: false, lossesCarriedForward: 0, amounts: {} },
            section6Appendix({ lossesCarriedForward: 0.4, amounts: { '022': 2.5, '023': 0.4 } }),
          ],
        }),
        { ...OPTIONS, rounding: 'halfUp' },
      );
      expect(result.capitalGains).toEqual([
        { symbol: 63, foreignAsset: false, amounts: {} },
        { symbol: 63, foreignAsset: true, amounts: { '022': 3, '056': 3000 } },
      ]);
    });

    it('removes an empty list, as the parser reads a report without capital-gains records', () => {
      expect(canonicalize(minimalInput({ capitalGains: [] }), OPTIONS)).not.toHaveProperty(
        'capitalGains',
      );
    });

    it.each([true, false])(
      'drops hasCapitalGainsAppendix %s when appendices already make 833 = yes',
      hasCapitalGainsAppendix => {
        const result = canonicalize(
          minimalInput({
            declarations: { hasCapitalGainsAppendix },
            capitalGains: [section6Appendix()],
          }),
          OPTIONS,
        );
        expect(result.declarations).not.toHaveProperty('hasCapitalGainsAppendix');
      },
    );

    it('keeps hasCapitalGainsAppendix true with an empty list', () => {
      const result = canonicalize(
        minimalInput({ declarations: { hasCapitalGainsAppendix: true }, capitalGains: [] }),
        OPTIONS,
      );
      expect(result.declarations.hasCapitalGainsAppendix).toBe(true);
    });
  });

  it('does not change its input', () => {
    const input: Report1214Input = minimalInput({ company: { fileNumber: '12' } });
    const copy = structuredClone(input);
    canonicalize(input, OPTIONS);
    expect(input).toEqual(copy);
  });
});
