import * as api from '../../src/index.js';
import type {
  CapitalGainsCode,
  CapitalGainsSymbol,
  CodeDef,
  CodeKind,
  CompanyDetails,
  CountryBreakdown,
  CountryBreakdownCode,
  CountryCode,
  CountryIncome,
  Declarations,
  DerivedMainCode,
  EnumValue,
  FieldDef,
  FieldKind,
  ForeignAppendix,
  ForeignAppendixCode,
  GenerateOptions,
  GenerateResult,
  IsoDate,
  Issue,
  MainFormCode,
  MainFormInputCode,
  ParseOptions,
  ParseResult,
  Phone,
  PhonePrefix,
  PreparerDetails,
  RdInvestment,
  RecordDef,
  RecordType,
  RelatedCompany,
  Report1214Input,
  Requirement,
  RuleId,
  RuleMeta,
  Severity,
  Shareholder,
  SupportedTaxYear,
  ValidateOptions,
  ValidationResult,
  YearLayout,
} from '../../src/index.js';

describe('public API', () => {
  it('exports exactly the public runtime values', () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        'Opcn1214Error',
        'Opcn1214InternalError',
        'Opcn1214ParseError',
        'Opcn1214UnsupportedYearError',
        'Opcn1214ValidationError',
        'RULES',
        'generate1214',
        'getLayout',
        'parse1214',
        'supportedTaxYears',
        'validate1214',
      ].sort(),
    );
  });

  it('exports the public types (a missing one fails the typecheck)', () => {
    expectTypeOf<Report1214Input['company']>().toEqualTypeOf<CompanyDetails>();
    expectTypeOf<Report1214Input['declarations']>().toEqualTypeOf<Declarations>();
    expectTypeOf<Report1214Input['preparer']>().toEqualTypeOf<PreparerDetails | undefined>();
    expectTypeOf<Report1214Input['shareholders']>().toEqualTypeOf<Shareholder[]>();
    expectTypeOf<Report1214Input['taxYear']>().toEqualTypeOf<SupportedTaxYear>();
    expectTypeOf<Report1214Input['relatedCompanies']>().toEqualTypeOf<
      RelatedCompany[] | undefined
    >();
    expectTypeOf<Report1214Input['rdInvestments']>().toEqualTypeOf<RdInvestment[] | undefined>();
    expectTypeOf<Report1214Input['foreignAppendix']>().toEqualTypeOf<ForeignAppendix | undefined>();
    expectTypeOf<ForeignAppendix['countryBreakdown']>().toEqualTypeOf<
      Partial<Record<CountryBreakdownCode, CountryBreakdown>> | undefined
    >();
    expectTypeOf<CountryBreakdown['countries']>().toEqualTypeOf<CountryIncome[]>();
    expectTypeOf<CountryIncome['country']>().toEqualTypeOf<CountryCode>();
    expectTypeOf<CompanyDetails['phone']>().toEqualTypeOf<Phone>();
    expectTypeOf<Phone['prefix']>().toEqualTypeOf<PhonePrefix>();
    expectTypeOf<IsoDate>().toEqualTypeOf<string>();
    expectTypeOf<keyof Report1214Input['amounts']>().toEqualTypeOf<MainFormInputCode>();
    expectTypeOf<MainFormInputCode>().toEqualTypeOf<Exclude<MainFormCode, DerivedMainCode>>();
    expectTypeOf<CountryBreakdownCode>().toExtend<ForeignAppendixCode>();
    expectTypeOf<CapitalGainsCode<CapitalGainsSymbol>>().toExtend<string>();
    expectTypeOf<'-88'>().toExtend<CountryCode>();
    expectTypeOf<GenerateOptions>().toEqualTypeOf<ValidateOptions>();
    expectTypeOf<ValidationResult['errors']>().toEqualTypeOf<Issue[]>();
    expectTypeOf<GenerateResult['warnings']>().toEqualTypeOf<Issue[]>();
    expectTypeOf<ParseResult['report']>().toEqualTypeOf<Report1214Input>();
    expectTypeOf<ParseResult['issues']>().toEqualTypeOf<Issue[]>();
    expectTypeOf<ParseOptions['encoding']>().toEqualTypeOf<'windows-1255' | 'utf-8' | undefined>();
    expectTypeOf<Issue['severity']>().toEqualTypeOf<Severity>();
    expectTypeOf<Issue['ruleId']>().toEqualTypeOf<RuleId>();
    expectTypeOf<(typeof api.RULES)[number]>().toExtend<RuleMeta>();
    expectTypeOf<YearLayout['records'][RecordType]>().toEqualTypeOf<RecordDef>();
    expectTypeOf<RecordDef['fields'][number]>().toEqualTypeOf<FieldDef>();
    expectTypeOf<RecordDef['codes'][number]>().toEqualTypeOf<CodeDef>();
    expectTypeOf<FieldDef['kind']>().toEqualTypeOf<FieldKind>();
    expectTypeOf<CodeDef['kind']>().toEqualTypeOf<CodeKind>();
    expectTypeOf<FieldDef['required']>().toEqualTypeOf<Requirement>();
    expectTypeOf<NonNullable<CodeDef['values']>[number]>().toEqualTypeOf<EnumValue>();
  });
});
