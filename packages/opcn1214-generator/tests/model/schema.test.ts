import type { z } from 'zod';
import type { PhonePrefix, Report1214Input } from '../../src/model/input.js';
import { report1214InputSchema, schemaFor } from '../../src/model/schema.js';
import { zodIssuesToIssues } from '../../src/validate/shape.js';
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

    it('reports an unknown amounts key as input.shape at amounts["999"]', () => {
      const input = { ...minimalInput(), amounts: { ...minimalInput().amounts, '999': 5 } };
      expect(shapeIssues(input)).toEqual([
        expect.objectContaining({ ruleId: 'input.shape', path: 'amounts["999"]', value: 5 }),
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
