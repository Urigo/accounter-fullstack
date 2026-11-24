import type { z } from 'zod';
import type { PhonePrefix, Report1214Input } from '../../src/model/input.js';
import { report1214InputSchema, schemaFor } from '../../src/model/schema.js';
import { checkShape, zodIssuesToIssues } from '../../src/validate/shape.js';
import { fullDeclarationsInput, fullMainInput, minimalInput } from '../fixtures/builders.js';

/** The input.shape issues of `input` against the schema of its year (2024 by default). */
function shapeIssues(input: unknown) {
  const result = schemaFor(2024).safeParse(input, { reportInput: true });
  return result.success ? [] : zodIssuesToIssues(result.error);
}

function shapePaths(input: unknown): string[] {
  return shapeIssues(input).map(issue => issue.path);
}

describe('input schema (SPEC §7.1, §9.2 stage 2)', () => {
  it('accepts the minimal input', () => {
    expect(shapeIssues(minimalInput())).toEqual([]);
  });

  it('shares one schema between the supported years', () => {
    expect(schemaFor(2025)).toBe(schemaFor(2024));
    expect(schemaFor(2024)).toBe(report1214InputSchema);
  });

  it('Report1214Input is assignable to the schema input (one direction only)', () => {
    expectTypeOf<Report1214Input>().toExtend<z.input<typeof report1214InputSchema>>();
  });

  it('the schema and Report1214Input declare the same properties at every depth', () => {
    // toExtend passes when only one side declares an optional property: compare property paths.
    type Paths<T, P extends string = ''> = T extends readonly (infer E)[]
      ? Paths<E, `${P}[]`>
      : T extends object
        ? {
            [K in keyof T & string]-?: `${P}.${K}` | Paths<NonNullable<T[K]>, `${P}.${K}`>;
          }[keyof T & string]
        : never;
    expectTypeOf<Paths<z.input<typeof report1214InputSchema>>>().toEqualTypeOf<
      Paths<Report1214Input>
    >();
  });

  describe('unknown properties', () => {
    it('reports an unknown nested property at its path', () => {
      const input = { ...minimalInput(), company: { ...minimalInput().company, faxx: 1 } };
      expect(shapeIssues(input)).toEqual([
        {
          ruleId: 'input.shape',
          severity: 'error',
          message: 'Unknown property "faxx".',
          path: 'company.faxx',
          value: 1,
        },
      ]);
    });

    it('reports one issue per unknown key, at any depth', () => {
      const base = minimalInput();
      const input = {
        ...base,
        extra: true,
        other: 'x',
        company: { ...base.company, phone: { ...base.company.phone, ext: '1' } },
        shareholders: [{ ...base.shareholders[0], nickname: 'a' }],
      };
      expect(shapePaths(input).sort()).toEqual([
        'company.phone.ext',
        'extra',
        'other',
        'shareholders[0].nickname',
      ]);
    });

    it('reports an unknown amounts key as input.unknownCode, not input.shape (SPEC §9.2)', () => {
      const input = { ...minimalInput(), amounts: { ...minimalInput().amounts, '999': 5 } };
      expect(checkShape(input, 2024)).toEqual([
        expect.objectContaining({ ruleId: 'input.unknownCode', path: 'amounts["999"]', value: 5 }),
      ]);
    });

    it('uses the bracket form for a non-identifier unknown key', () => {
      const input = { ...minimalInput(), 'tax-year': 2024 };
      expect(shapePaths(input)).toEqual(['["tax-year"]']);
    });
  });

  describe('null and undefined', () => {
    it('rejects null for an optional property', () => {
      expect(shapeIssues(minimalInput({ company: { email: null as unknown as string } }))).toEqual([
        expect.objectContaining({ ruleId: 'input.shape', path: 'company.email', value: null }),
      ]);
      expect(shapePaths({ ...minimalInput(), meta: null })).toEqual(['meta']);
    });

    it('accepts undefined optional members', () => {
      const input = minimalInput({
        meta: { softwareName: undefined, saveDate: undefined },
        company: { email: undefined, fax: undefined },
      });
      expect(shapeIssues(input)).toEqual([]);
    });

    it('accepts undefined amounts values', () => {
      expect(shapeIssues(minimalInput({ amounts: { '010': undefined } }))).toEqual([]);
    });

    it('reports a missing required property', () => {
      const { company: _, ...input } = minimalInput();
      expect(shapePaths(input)).toEqual(['company']);
    });
  });

  describe('types', () => {
    it("reports '2024' for taxYear at 'taxYear'", () => {
      expect(shapeIssues({ ...minimalInput(), taxYear: '2024' })).toEqual([
        expect.objectContaining({ ruleId: 'input.shape', path: 'taxYear', value: '2024' }),
      ]);
    });

    it('reports a wrong type with what was expected', () => {
      const input = minimalInput({ declarations: { hasTaxPlanningAction: 'no' as never } });
      expect(shapeIssues(input)).toEqual([
        expect.objectContaining({
          path: 'declarations.hasTaxPlanningAction',
          value: 'no',
          expected: 'boolean',
        }),
      ]);
    });

    it('reports a non-ISO date', () => {
      expect(shapePaths(minimalInput({ meta: { saveDate: '30/06/2024' } }))).toEqual([
        'meta.saveDate',
      ]);
    });

    it('leaves calendar validity to field.date', () => {
      expect(shapeIssues(minimalInput({ meta: { saveDate: '2024-02-30' } }))).toEqual([]);
    });

    it('accepts any string as a phone prefix (field.phonePrefix checks it)', () => {
      const input = minimalInput({ company: { phone: { prefix: '01' as PhonePrefix } } });
      expect(shapeIssues(input)).toEqual([]);
    });

    it('accepts non-digit strings for digit fields (field.numeric checks them)', () => {
      expect(shapeIssues(minimalInput({ company: { fileNumber: '12a' } }))).toEqual([]);
    });

    it('does not carry an object value', () => {
      const [issue] = shapeIssues({ ...minimalInput(), shareholders: {} });
      expect(issue).toEqual(expect.objectContaining({ path: 'shareholders', expected: 'array' }));
      expect(issue).not.toHaveProperty('value');
    });
  });

  describe('declarations and preparer', () => {
    it('accepts every optional declaration and the preparer', () => {
      expect(shapeIssues(fullDeclarationsInput())).toEqual([]);
    });

    it('accepts an empty preparer and undefined optional declarations', () => {
      const input = minimalInput({
        preparer: {},
        declarations: { form6111Obligation: undefined, familyCompany: undefined },
      });
      expect(shapeIssues(input)).toEqual([]);
    });

    it('reports unknown properties of the preparer, its phone and the declaration objects', () => {
      const base = fullDeclarationsInput();
      const input = {
        ...base,
        preparer: { ...base.preparer, mobile: '1', phone: { ...base.preparer?.phone, ext: '2' } },
        declarations: {
          ...base.declarations,
          isFamilyCompany: true,
          familyCompany: { representativeFileNumber: '1', marked: true },
          beneficiaryEnterprise: { noticeDate: '2024-01-01', marked: true },
          specialYear: { balanceSheetDate: '2024-01-01', marked: true },
        },
      };
      expect(shapePaths(input).sort()).toEqual([
        'declarations.beneficiaryEnterprise.marked',
        'declarations.familyCompany.marked',
        'declarations.isFamilyCompany',
        'declarations.specialYear.marked',
        'preparer.mobile',
        'preparer.phone.ext',
      ]);
    });

    it('requires the member of each declaration object', () => {
      const input = minimalInput({
        declarations: {
          familyCompany: {} as never,
          beneficiaryEnterprise: {} as never,
          specialYear: {} as never,
        },
      });
      expect(shapePaths(input).sort()).toEqual([
        'declarations.beneficiaryEnterprise.noticeDate',
        'declarations.familyCompany.representativeFileNumber',
        'declarations.specialYear.balanceSheetDate',
      ]);
    });

    it('reports non-ISO declaration dates', () => {
      const input = minimalInput({
        declarations: {
          beneficiaryEnterprise: { noticeDate: '14/05/2023' },
          specialYear: { balanceSheetDate: '2024-9-30' },
        },
      });
      expect(shapePaths(input).sort()).toEqual([
        'declarations.beneficiaryEnterprise.noticeDate',
        'declarations.specialYear.balanceSheetDate',
      ]);
    });

    it.each([
      ['form6111Obligation', 'required'],
      ['consolidatedReport', 'consolidated'],
    ])('reports a %s that is not one of its literals', (member, value) => {
      const input = minimalInput({ declarations: { [member]: value as never } });
      expect(shapePaths(input)).toEqual([`declarations.${member}`]);
    });

    it('accepts any number of integer reportable positions (D4 reports more than five)', () => {
      const positions = [1, 2, 3, 4, 5, 6, 7];
      expect(
        shapeIssues(minimalInput({ declarations: { reportablePositions: positions } })),
      ).toEqual([]);
      expect(shapeIssues(minimalInput({ declarations: { reportablePositions: [] } }))).toEqual([]);
    });

    it('rejects reportable positions that are not integers', () => {
      const input = minimalInput({
        declarations: { reportablePositions: [1, 2.5, '3' as never] },
      });
      expect(shapePaths(input)).toEqual([
        'declarations.reportablePositions[1]',
        'declarations.reportablePositions[2]',
      ]);
    });

    it('accepts any string as the preparer phone prefix (field.phonePrefix checks it)', () => {
      const input = fullDeclarationsInput({ preparer: { phone: { prefix: '01' as PhonePrefix } } });
      expect(shapeIssues(input)).toEqual([]);
    });

    it.each([
      'financialStatementsAttached',
      'requestsAdvancePayments',
      'hasCapitalGainsAppendix',
      'noBankAccount',
    ])('reports a non-boolean %s', member => {
      const input = minimalInput({ declarations: { [member]: 1 as never } });
      expect(shapeIssues(input)).toEqual([
        expect.objectContaining({ path: `declarations.${member}`, expected: 'boolean' }),
      ]);
    });
  });

  describe('other income, attachments, capital-gains summary and qualifying company', () => {
    it('accepts every member', () => {
      expect(shapeIssues(fullMainInput())).toEqual([]);
    });

    it('accepts empty groups and undefined members', () => {
      const input = minimalInput({
        otherTaxableIncome: {},
        attachments: { donationReceiptsCount: undefined },
        capitalGainsSummary: { reasons: {} },
        qualifyingCompany: { amortizationAmount: undefined },
      });
      expect(shapeIssues(input)).toEqual([]);
    });

    it('reports unknown properties of every group', () => {
      const base = fullMainInput();
      const input = {
        ...base,
        otherTaxableIncome: { ...base.otherTaxableIncome, description: 'x' },
        attachments: { ...base.attachments, count: 1 },
        capitalGainsSummary: {
          ...base.capitalGainsSummary,
          transmittedCount: 1,
          reasons: { ...base.capitalGainsSummary?.reasons, unknown: true },
        },
        qualifyingCompany: { ...base.qualifyingCompany, amount: 1 },
      };
      expect(shapePaths(input).sort()).toEqual([
        'attachments.count',
        'capitalGainsSummary.reasons.unknown',
        'capitalGainsSummary.transmittedCount',
        'otherTaxableIncome.description',
        'qualifyingCompany.amount',
      ]);
    });

    it('reports members of the wrong type', () => {
      const input = minimalInput({
        otherTaxableIncome: { source: 1 as never, ratePercent: '10' as never },
        attachments: { donationReceiptsCount: '2' as never },
        capitalGainsSummary: { untransmittedCount: true as never, reasons: { other: 1 as never } },
        qualifyingCompany: { purchased: 'yes' as never, amortizationAmount: '0' as never },
      });
      expect(shapePaths(input).sort()).toEqual([
        'attachments.donationReceiptsCount',
        'capitalGainsSummary.reasons.other',
        'capitalGainsSummary.untransmittedCount',
        'otherTaxableIncome.ratePercent',
        'otherTaxableIncome.source',
        'qualifyingCompany.amortizationAmount',
        'qualifyingCompany.purchased',
      ]);
    });

    it('rejects null groups', () => {
      const input = { ...minimalInput(), attachments: null };
      expect(shapePaths(input)).toEqual(['attachments']);
    });
  });

  describe('bankAccount', () => {
    it('accepts a bank account of digit strings, and any string (main.bankAccount.format checks it)', () => {
      expect(
        shapeIssues(minimalInput({ bankAccount: { bank: '12', branch: '345', account: '678' } })),
      ).toEqual([]);
      expect(
        shapeIssues(minimalInput({ bankAccount: { bank: '1', branch: 'x', account: '' } })),
      ).toEqual([]);
    });

    it('requires every member as a string and rejects unknown members', () => {
      const input = {
        ...minimalInput(),
        bankAccount: { bank: 12, branch: '345', iban: 'IL' },
      };
      expect(shapePaths(input).sort()).toEqual([
        'bankAccount.account',
        'bankAccount.bank',
        'bankAccount.iban',
      ]);
    });
  });

  describe('code maps (SPEC §9.2: scanned before zod)', () => {
    it('reports a derived amounts key as input.derivedCode naming the controlling property', () => {
      const input = { ...minimalInput(), amounts: { ...minimalInput().amounts, '297': 8 } };
      expect(checkShape(input, 2024)).toEqual([
        {
          ruleId: 'input.derivedCode',
          severity: 'error',
          message:
            'Code 297 is derived from declarations.form6111Obligation (SPEC §7.4); remove it from amounts.',
          path: 'amounts["297"]',
          recordType: '1000',
          recordIndex: 0,
          code: '297',
          value: 8,
        },
      ]);
    });

    it.each([
      ['008', 'declarations.appliesAccountingStandards'],
      ['028', 'capitalGainsSummary.untransmittedCount'],
      ['273', 'declarations.directorsReceivedOpinion and declarations.tookReportablePosition'],
      ['277', 'bankAccount'],
      ['278', 'bankAccount'],
      ['280', 'bankAccount'],
      ['297', 'declarations.form6111Obligation'],
    ])('names the input of derived code %s: %s', (code, source) => {
      const input = { ...minimalInput(), amounts: { [code]: 1 } };
      const [issue, ...rest] = checkShape(input, 2024);
      expect(rest).toEqual([]);
      expect(issue?.ruleId).toBe('input.derivedCode');
      expect(issue?.message).toContain(`derived from ${source} `);
    });

    it('reports unknown and derived keys together with the zod issues, each once', () => {
      const input = {
        ...minimalInput(),
        company: { ...minimalInput().company, faxx: 1 },
        amounts: { '010': 'x', '999': 5, abc: undefined, '273': 1 },
      };
      expect(
        checkShape(input, 2024)
          .map(issue => [issue.ruleId, issue.path])
          .sort(),
      ).toEqual([
        ['input.derivedCode', 'amounts["273"]'],
        ['input.shape', 'amounts["010"]'],
        ['input.shape', 'company.faxx'],
        ['input.unknownCode', 'amounts["999"]'],
        ['input.unknownCode', 'amounts["abc"]'],
      ]);
    });

    it('leaves a code map that is not an object to zod', () => {
      expect(checkShape({ ...minimalInput(), amounts: [] }, 2024)).toEqual([
        expect.objectContaining({ ruleId: 'input.shape', path: 'amounts' }),
      ]);
      expect(checkShape({ ...minimalInput(), amounts: null }, 2024)).toEqual([
        expect.objectContaining({ ruleId: 'input.shape', path: 'amounts' }),
      ]);
    });

    class AmountsClass {
      '018' = 4;
    }

    it.each([
      ['a Map', () => new Map([['018', 4]])],
      ['a Date', () => new Date()],
      ['a class instance', () => new AmountsClass()],
    ])('leaves %s to zod, which reports input.shape', (_name, amounts) => {
      expect(checkShape({ ...minimalInput(), amounts: amounts() }, 2024)).toEqual([
        expect.objectContaining({ ruleId: 'input.shape', path: 'amounts' }),
      ]);
    });

    it('scans a code map without a prototype (Object.create(null))', () => {
      const amounts = Object.assign(Object.create(null) as Record<string, number>, {
        ...minimalInput().amounts,
        '999': 5,
      });
      expect(
        checkShape({ ...minimalInput(), amounts }, 2024).map(issue => [issue.ruleId, issue.path]),
      ).toEqual([['input.unknownCode', 'amounts["999"]']]);
    });

    it('reports an own "__proto__" key (as JSON.parse makes it) as input.unknownCode', () => {
      const amounts: unknown = JSON.parse(
        JSON.stringify(minimalInput().amounts).replace('{', '{"__proto__":5,'),
      );
      expect(Object.keys(amounts as object)).toContain('__proto__');
      expect(
        checkShape({ ...minimalInput(), amounts }, 2024).map(issue => [issue.ruleId, issue.path]),
      ).toEqual([['input.unknownCode', 'amounts["__proto__"]']]);
    });

    it('suggests the 3-digit code for a number key ({ 18: … })', () => {
      const [issue, ...rest] = checkShape(
        { ...minimalInput(), amounts: { ...minimalInput().amounts, 18: 4 } },
        2024,
      );
      expect(rest).toEqual([]);
      expect(issue).toMatchObject({ ruleId: 'input.unknownCode', path: 'amounts["18"]' });
      expect(issue?.message).toBe(
        '"18" is not a code of record 1000 for tax year 2024. Did you mean "018"?',
      );
    });

    it('gives no hint when the padded key is not a code either', () => {
      const [issue] = checkShape({ ...minimalInput(), amounts: { 7: 1 } }, 2024);
      expect(issue?.message).toBe('"7" is not a code of record 1000 for tax year 2024.');
    });

    it('leaves an input that is not an object to zod', () => {
      expect(checkShape(null, 2024).map(issue => [issue.ruleId, issue.path])).toEqual([
        ['input.shape', ''],
      ]);
    });

    it('does not change its input', () => {
      const input = { ...minimalInput(), amounts: { '999': 5 } };
      checkShape(input, 2024);
      expect(input.amounts).toEqual({ '999': 5 });
    });

    it('accepts the minimal input', () => {
      expect(checkShape(minimalInput(), 2024)).toEqual([]);
    });
  });

  describe('path conversion (SPEC §9.1 grammar)', () => {
    it("converts ['shareholders', 2, 'fullName'] to shareholders[2].fullName", () => {
      const shareholder = minimalInput().shareholders[0];
      const input = minimalInput({
        shareholders: [shareholder!, shareholder!, { ...shareholder!, fullName: 7 as never }],
      });
      expect(shapePaths(input)).toEqual(['shareholders[2].fullName']);
    });

    it("converts ['amounts', '018'] to amounts[\"018\"]", () => {
      expect(shapePaths(minimalInput({ amounts: { '018': '4' as never } }))).toEqual([
        'amounts["018"]',
      ]);
    });

    it("uses '' for the root", () => {
      expect(shapePaths(null)).toEqual(['']);
    });
  });
});
