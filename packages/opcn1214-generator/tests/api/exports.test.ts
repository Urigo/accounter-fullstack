import * as api from '../../src/index.js';
import type {
  AssetLocation,
  BettermentTaxAppendix,
  CapitalGainsAppendix,
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
  ForcedVirtualCurrencyAppendix,
  ForeignAppendix,
  ForeignAppendixCode,
  GenerateOptions,
  GenerateResult,
  IsoDate,
  Issue,
  MainFormCode,
  MainFormInputCode,
  NoWithholding1322Appendix,
  NoWithholding1326Appendix,
  OilPartnershipAppendix,
  OtherTransactionsAppendix,
  ParseOptions,
  ParseResult,
  Phone,
  PhonePrefix,
  PreparerDetails,
  RdInvestment,
  RecordDef,
  RecordType,
  ReitAppendix,
  RelatedCompany,
  Report1214Input,
  Requirement,
  RuleId,
  RuleMeta,
  Section6SecuritiesAppendix,
  SecuritiesAppendix,
  Severity,
  Shareholder,
  SharesAppendix,
  SupportedTaxYear,
  ValidateOptions,
  ValidationResult,
  Withholder,
  WithholdingStatus,
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

  it('exports RULES deep-frozen, so a consumer cannot change validation in place', () => {
    expect(Object.isFrozen(api.RULES)).toBe(true);
    expect(api.RULES.every(rule => Object.isFrozen(rule))).toBe(true);
    expect(Object.isFrozen(api.RULES[0])).toBe(true);
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
    expectTypeOf<Report1214Input['capitalGains']>().toEqualTypeOf<
      CapitalGainsAppendix[] | undefined
    >();
    expectTypeOf<Section6SecuritiesAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<keyof Section6SecuritiesAppendix['amounts']>().toEqualTypeOf<
      CapitalGainsCode<63>
    >();
    expectTypeOf<SecuritiesAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<ReitAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<NoWithholding1322Appendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<NoWithholding1326Appendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<SharesAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<BettermentTaxAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<ForcedVirtualCurrencyAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<OilPartnershipAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<OtherTransactionsAppendix>().toExtend<CapitalGainsAppendix>();
    expectTypeOf<CapitalGainsAppendix['symbol']>().toEqualTypeOf<CapitalGainsSymbol>();
    expectTypeOf<CapitalGainsAppendix['symbol']>().toEqualTypeOf<
      27 | 50 | 51 | 54 | 60 | 63 | 64 | 65 | 66 | 77
    >();
    expectTypeOf<keyof OtherTransactionsAppendix['amounts']>().toEqualTypeOf<
      Exclude<CapitalGainsCode<77>, '501' | '502' | '503' | '504' | '505'>
    >();
    expectTypeOf<OtherTransactionsAppendix['dates']>().toEqualTypeOf<{
      code15: IsoDate;
      code20: IsoDate;
    }>();
    expectTypeOf<OtherTransactionsAppendix['improvements']>().toEqualTypeOf<
      | Array<{
          expense?: number;
          accumulatedDepreciation?: number;
          date: IsoDate;
          code50Amount?: number;
        }>
      | undefined
    >();
    expectTypeOf<OtherTransactionsAppendix['replacementAsset']>().toEqualTypeOf<
      { details?: string; purchaseDate?: IsoDate; price?: number } | undefined
    >();
    expectTypeOf<OtherTransactionsAppendix['walletAddresses']>().toEqualTypeOf<
      [string] | [string, string] | undefined
    >();
    expectTypeOf<keyof OtherTransactionsAppendix>().toEqualTypeOf<
      | 'symbol'
      | 'expropriation'
      | 'assetDetails'
      | 'assetLocation'
      | 'relatedParty'
      | 'buyerName'
      | 'dates'
      | 'improvements'
      | 'replacementAsset'
      | 'walletAddresses'
      | 'amounts'
    >();
    expectTypeOf<keyof SharesAppendix['amounts']>().toEqualTypeOf<CapitalGainsCode<27>>();
    expectTypeOf<keyof BettermentTaxAppendix['amounts']>().toEqualTypeOf<CapitalGainsCode<50>>();
    expectTypeOf<keyof ForcedVirtualCurrencyAppendix['amounts']>().toEqualTypeOf<
      CapitalGainsCode<51>
    >();
    expectTypeOf<keyof OilPartnershipAppendix['amounts']>().toEqualTypeOf<CapitalGainsCode<54>>();
    expectTypeOf<AssetLocation>().toEqualTypeOf<'abroad' | 'israel'>();
    expectTypeOf<SharesAppendix['assetLocation']>().toEqualTypeOf<AssetLocation | undefined>();
    expectTypeOf<SharesAppendix['dates']>().toEqualTypeOf<
      { code15?: IsoDate; code20?: IsoDate; code53?: IsoDate } | undefined
    >();
    expectTypeOf<BettermentTaxAppendix['purchaseDate']>().toEqualTypeOf<IsoDate>();
    expectTypeOf<BettermentTaxAppendix['dates']>().toEqualTypeOf<{ code15: IsoDate }>();
    expectTypeOf<OilPartnershipAppendix['purchaseDate']>().toEqualTypeOf<IsoDate>();
    expectTypeOf<OilPartnershipAppendix['dates']>().toEqualTypeOf<{ code15: IsoDate }>();
    expectTypeOf<ForcedVirtualCurrencyAppendix['dates']>().toEqualTypeOf<{ code15: IsoDate }>();
    expectTypeOf<ForcedVirtualCurrencyAppendix['walletAddresses']>().toEqualTypeOf<
      [string] | [string, string] | undefined
    >();
    expectTypeOf<keyof BettermentTaxAppendix>().toEqualTypeOf<
      'symbol' | 'expropriation' | 'assetDetails' | 'purchaseDate' | 'dates' | 'amounts'
    >();
    expectTypeOf<keyof OilPartnershipAppendix>().toEqualTypeOf<
      'symbol' | 'assetDetails' | 'purchaseDate' | 'dates' | 'amounts'
    >();
    expectTypeOf<keyof ForcedVirtualCurrencyAppendix>().toEqualTypeOf<
      | 'symbol'
      | 'assetDetails'
      | 'assetLocation'
      | 'relatedParty'
      | 'buyerName'
      | 'dates'
      | 'walletAddresses'
      | 'amounts'
    >();
    expectTypeOf<keyof NoWithholding1322Appendix['amounts']>().toEqualTypeOf<
      CapitalGainsCode<65>
    >();
    expectTypeOf<keyof NoWithholding1326Appendix['amounts']>().toEqualTypeOf<
      CapitalGainsCode<66>
    >();
    expectTypeOf<NoWithholding1322Appendix['withholders']>().toEqualTypeOf<
      Withholder[] | undefined
    >();
    expectTypeOf<WithholdingStatus>().toEqualTypeOf<
      'notWithheldFirstHalf' | 'notWithheldSecondHalf'
    >();
    expectTypeOf<NoWithholding1322Appendix['withholdingStatus']>().toEqualTypeOf<
      WithholdingStatus | undefined
    >();
    expectTypeOf<NoWithholding1326Appendix['withholdingStatus']>().toEqualTypeOf<
      WithholdingStatus | undefined
    >();
    expectTypeOf<keyof NoWithholding1326Appendix>().toEqualTypeOf<
      'symbol' | 'foreignAsset' | 'withholdingStatus' | 'lossesCarriedForward' | 'amounts'
    >();
    expectTypeOf<keyof SecuritiesAppendix['amounts']>().toEqualTypeOf<CapitalGainsCode<60>>();
    expectTypeOf<keyof ReitAppendix['amounts']>().toEqualTypeOf<CapitalGainsCode<64>>();
    expectTypeOf<SecuritiesAppendix['withholders']>().toEqualTypeOf<Withholder[] | undefined>();
    expectTypeOf<ReitAppendix['withholders']>().toEqualTypeOf<Withholder[] | undefined>();
    expectTypeOf<Withholder>().toEqualTypeOf<{
      name?: string;
      branch?: string;
      account?: string;
    }>();
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
