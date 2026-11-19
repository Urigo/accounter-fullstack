/**
 * Input builders for tests. `minimalInput()` is the smallest fileable report: it must stay valid
 * against EVERY rule of SPEC §10 (no errors and no warnings); later steps rely on that, so any
 * change here has to keep it so.
 */
import { COUNTRY_CODES } from '../../src/model/codes.generated.js';
import type {
  BettermentTaxAppendix,
  CountryBreakdown,
  CountryIncome,
  ForcedVirtualCurrencyAppendix,
  ForeignAppendix,
  NoWithholding1322Appendix,
  NoWithholding1326Appendix,
  OilPartnershipAppendix,
  OtherTransactionsAppendix,
  RdInvestment,
  ReitAppendix,
  RelatedCompany,
  Report1214Input,
  Section6SecuritiesAppendix,
  SecuritiesAppendix,
  SharesAppendix,
  Withholder,
} from '../../src/model/input.js';
import { isValidIsraeliCheckDigit } from '../../src/validate/check-digit.js';

/** Overrides for a builder: objects merge recursively, arrays and other values replace. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, overrides: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return overrides;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

/**
 * The 9-digit identifier made of the 8 digits of `prefix` (left-padded with zeros) and the check
 * digit that makes it valid (SPEC §15 A-25), e.g. 51_000_000 → '510000003'.
 */
export function withCheckDigit(prefix: number): string {
  const digits = String(prefix).padStart(8, '0');
  for (let check = 0; check <= 9; check++) {
    if (isValidIsraeliCheckDigit(`${digits}${check}`)) {
      return `${digits}${check}`;
    }
  }
  throw new Error(`no check digit for ${digits}`);
}

/** A valid skeleton report (SPEC §7.2) with `overrides` deep-merged into it. */
export function minimalInput(overrides: DeepPartial<Report1214Input> = {}): Report1214Input {
  const base: Report1214Input = {
    taxYear: 2024,
    company: {
      fileNumber: '514000009',
      registeredName: 'חברה לדוגמה בע"מ',
      mailingAddress: 'רחוב הרצל 1, תל אביב',
      businessAddress: 'רחוב הרצל 1, תל אביב',
      phone: { prefix: '03', number: '1234567' },
    },
    declarations: {
      hasTaxPlanningAction: false,
      hadRelatedPartyTransactions: false,
      controlsBodyOfPersons: false,
      holdsRightsInBodyOfPersons: false,
      appliesAccountingStandards: false,
      directorsReceivedOpinion: false,
      tookReportablePosition: false,
    },
    amounts: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
    shareholders: [
      {
        idNumber: '123456782',
        fullName: 'ישראל ישראלי',
        isControllingShareholder: true,
        dividendRightsPercent: 100,
      },
    ],
  };
  return deepMerge(base, overrides) as Report1214Input;
}

/**
 * `minimalInput()` with the preparer and every optional declaration set (SPEC §7.2), each to a
 * value that is written to the file (flags marked, yes/no members answered), plus the codes the
 * declarations call for (080 family company, 084 house company, 226 kibbutz). `overrides` are
 * deep-merged into it.
 */
export function fullDeclarationsInput(
  overrides: DeepPartial<Report1214Input> = {},
): Report1214Input {
  const base = minimalInput({
    preparer: {
      officeName: 'משרד רואי חשבון',
      contactName: 'דנה כהן',
      name: 'יוסי לוי',
      profession: 'רואה חשבון',
      licensedDealerNumber: '012345674',
      address: 'רחוב יפו 10, ירושלים',
      phone: { prefix: '02', number: '6543210' },
    },
    declarations: {
      tookReportablePosition: true,
      reportablePositions: [12, 7, 345, 1, 999],
      form6111Obligation: 'obliged',
      financialStatementsAttached: true,
      familyCompany: { representativeFileNumber: '300000007' },
      isHouseCompany: true,
      form1343Attached: true,
      form1344Attached: true,
      claimsCapitalInvestmentLawBenefits: true,
      preferredEnterprise: true,
      beneficiaryEnterprise: { noticeDate: '2023-05-14' },
      dividendDistributed: true,
      specialYear: { balanceSheetDate: '2024-09-30' },
      foreignInvestors: true,
      consolidatedReport: 'consolidatesWithParent',
      partnerInPartnership: true,
      isKibbutz: true,
      requestsAdvancePayments: true,
      hasBuildingIncome: false,
      isTrustBeneficiary: true,
      nonDeductibleSalaryExpenses: true,
      fewMembersCompany62A: true,
      partOfMultinationalGroup: true,
      noBankAccount: true,
      hasCapitalGainsAppendix: true,
    },
    amounts: { '080': 0, '084': 0, '226': 1 },
  });
  return deepMerge(base, overrides) as Report1214Input;
}

/**
 * `fullDeclarationsInput()` with the remaining header groups of record 1000 set (SPEC §7.2): other
 * taxable income, attachments (with the codes 070 and 010 they certify), the capital-gains summary,
 * the qualifying company and the bank account, each member to a value that is written to the file.
 * 833 is derived from the untransmitted count, so `hasCapitalGainsAppendix` is left out (the input
 * is canonical), and `noBankAccount` is left out because a bank account is given. `overrides` are
 * deep-merged into it.
 */
export function fullMainInput(overrides: DeepPartial<Report1214Input> = {}): Report1214Input {
  const base = deepMerge(fullDeclarationsInput(), {
    otherTaxableIncome: { source: 'דמי שכירות', amount: 25_000, ratePercent: 10.23 },
    attachments: { donationReceiptsCount: 2, withholdingCertificatesCount: 3 },
    capitalGainsSummary: {
      totalAppendicesCount: 4,
      untransmittedCount: 3,
      reasons: {
        lossOrNoGain: true,
        overFiveImprovementBalances: true,
        over14Appendices: true,
        other: true,
        otherText: 'העסקה בוטלה',
      },
    },
    qualifyingCompany: {
      purchased: true,
      israeliPurchaseAmount: 1_000_000,
      foreignPurchaseAmount: 2_500_000,
      amortizationClaimed: true,
      amortizationAmount: 150_000,
    },
    bankAccount: { bank: '12', branch: '345', account: '123456789' },
    amounts: { '010': 1200, '070': 500 },
  }) as Report1214Input;
  delete base.declarations.hasCapitalGainsAppendix;
  // A bank account and noBankAccount contradict each other (main.bankAccount.withNoBank).
  delete base.declarations.noBankAccount;
  return deepMerge(base, overrides) as Report1214Input;
}

/** The relation types of SPEC §7.2 in code order (1..8). */
const RELATION_TYPES: ReadonlyArray<RelatedCompany['relationType']> = [
  'parent',
  'subsidiary',
  'partnership',
  'kibbutzRelatedCorporation',
  'jointlyControlled',
  'granddaughter',
  'grandmother',
  'other',
];

/**
 * `count` valid related companies (SPEC §7.2), every member set to a value that is written to the
 * file; the i-th (0-based) has relation type i + 1 (cycling through the eight types).
 */
export function relatedCompanies(count: number): RelatedCompany[] {
  return Array.from({ length: count }, (_, index) => ({
    companyName: `חברה קשורה ${index + 1} בע"מ`,
    companyFileNumber: withCheckDigit(51_000_000 + index),
    relationType: RELATION_TYPES[index % RELATION_TYPES.length]!,
    assessingOfficeCode: 10 + index,
  }));
}

/**
 * `count` valid R&D investments (SPEC §7.2), every member set to a value that is written to the
 * file; the i-th (0-based) invests 100,000 × (i + 1). Their total is `rdInvestmentsTotal(count)`.
 */
export function rdInvestments(count: number): RdInvestment[] {
  return Array.from({ length: count }, (_, index) => ({
    companyName: `חברת מו"פ ${index + 1} בע"מ`,
    companyFileNumber: withCheckDigit(52_000_000 + index),
    investmentAmount: 100_000 * (index + 1),
  }));
}

/** The total investment of `rdInvestments(count)`, the code 165 that matches it. */
export function rdInvestmentsTotal(count: number): number {
  return rdInvestments(count).reduce((sum, investment) => sum + investment.investmentAmount, 0);
}

/**
 * A valid foreign appendix (SPEC §7.2, record 2000) with every header member set to a value that is
 * written to the file and three codes that call for no country breakdown (401, 425, 494).
 * `overrides` are deep-merged into it.
 */
export function foreignAppendix(overrides: DeepPartial<ForeignAppendix> = {}): ForeignAppendix {
  const base: ForeignAppendix = {
    otherTaxableIncomeDescription: 'תמלוגים מחו"ל',
    otherTaxableIncome: 40_000,
    foreignTaxPaidOnOtherIncome: 6000,
    totalForeignTaxableIncome: 120_000,
    totalForeignLoss: 15_000,
    participationExemptionHoldingCompany: 7000,
    taxRefundDeclaration: true,
    taxRefundDeclarationAmount: 2500,
    amounts: { '401': 80_000, '425': 12_345, '494': 1 },
  };
  return deepMerge(base, overrides) as ForeignAppendix;
}

/**
 * `count` valid countries of a breakdown (SPEC §7.2): distinct known country codes other than
 * '-88', in table order; the i-th (0-based) earns 1000 × (i + 1).
 */
export function breakdownCountries(count: number): CountryIncome[] {
  return COUNTRY_CODES.filter(country => country !== '-88')
    .slice(0, count)
    .map((country, index) => ({ country, income: 1000 * (index + 1) }));
}

/**
 * `foreignAppendix()` with `code` (a per-country code) written with 5000 and broken down by
 * `breakdown` (default: deductions 300 and two countries). `overrides` are deep-merged into it.
 */
export function foreignAppendixWithBreakdown(
  code: keyof NonNullable<ForeignAppendix['countryBreakdown']>,
  breakdown: CountryBreakdown = {
    deductionsOffsetsAndExemptions: 300,
    countries: breakdownCountries(2),
  },
  overrides: DeepPartial<ForeignAppendix> = {},
): ForeignAppendix {
  const appendix = foreignAppendix({ amounts: { [code]: 5000 } });
  appendix.countryBreakdown = { [code]: breakdown };
  return deepMerge(appendix, overrides) as ForeignAppendix;
}

/**
 * A valid capital-gains appendix for securities under section 6 (SPEC §7.2, record 3063) with every
 * member set to a value that is written to the file and two codes (022, 056). `overrides` are
 * deep-merged into it.
 */
export function section6Appendix(
  overrides: DeepPartial<Section6SecuritiesAppendix> = {},
): Section6SecuritiesAppendix {
  const base: Section6SecuritiesAppendix = {
    symbol: 63,
    foreignAsset: true,
    lossesCarriedForward: 12_000,
    amounts: { '022': 50_000, '056': 3000 },
  };
  return deepMerge(base, overrides) as Section6SecuritiesAppendix;
}

/** `count` valid 3063 appendices; the i-th (0-based) has code 022 = 1000 × (i + 1). */
export function section6Appendices(count: number): Section6SecuritiesAppendix[] {
  return Array.from({ length: count }, (_, index) =>
    section6Appendix({ amounts: { '022': 1000 * (index + 1) } }),
  );
}

/** Hebrew names of the withholding agents withholders(count) returns, in slot order. */
const WITHHOLDER_NAMES = ['בנק הפועלים', 'בנק לאומי', 'בנק דיסקונט', 'בנק מזרחי טפחות'];

/**
 * `count` (at most 4) valid withholding agents, canonical (SPEC §8.4): a Hebrew name, a 3-digit
 * branch and a 9-digit account; the i-th (0-based) has branch `01${i + 1}`.
 */
export function withholders(count: number): Withholder[] {
  return WITHHOLDER_NAMES.slice(0, count).map((name, index) => ({
    name,
    branch: `01${index + 1}`,
    account: `00012345${index}`,
  }));
}

/**
 * A valid capital-gains appendix for securities (SPEC §7.2, record 3060) with every header member
 * set to a value that is written to the file (two withholders) and two codes (012, 056).
 * `overrides` are deep-merged into it.
 */
export function securitiesAppendix(
  overrides: DeepPartial<SecuritiesAppendix> = {},
): SecuritiesAppendix {
  const base: SecuritiesAppendix = {
    symbol: 60,
    foreignAsset: true,
    soldToRelatedParty: false,
    boughtFromRelatedParty: true,
    gainFromInvestmentFund: false,
    withholders: withholders(2),
    lossesCarriedForward: 8000,
    amounts: { '012': 40_000, '056': 2000 },
  };
  return deepMerge(base, overrides) as SecuritiesAppendix;
}

/**
 * A valid capital-gains appendix for real-estate investment trusts (SPEC §7.2, record 3064) with
 * every header member set to a value that is written to the file (one withholder) and two codes
 * (013, 056). `overrides` are deep-merged into it.
 */
export function reitAppendix(overrides: DeepPartial<ReitAppendix> = {}): ReitAppendix {
  const base: ReitAppendix = {
    symbol: 64,
    foreignAsset: false,
    soldToRelatedParty: true,
    boughtFromRelatedParty: false,
    gainFromInvestmentFund: true,
    withholders: withholders(1),
    lossesCarriedForward: 5000,
    amounts: { '013': 30_000, '056': 1500 },
  };
  return deepMerge(base, overrides) as ReitAppendix;
}

/**
 * A valid capital-gains appendix for securities without withholding, form 1322 (SPEC §7.2, record
 * 3065) with every header member set to a value that is written to the file (two withholders) and
 * two codes (012, 056). `overrides` are deep-merged into it.
 */
export function noWithholding1322Appendix(
  overrides: DeepPartial<NoWithholding1322Appendix> = {},
): NoWithholding1322Appendix {
  const base: NoWithholding1322Appendix = {
    symbol: 65,
    foreignAsset: false,
    soldToRelatedParty: true,
    boughtFromRelatedParty: true,
    gainFromInvestmentFund: false,
    withholdingStatus: 'notWithheldFirstHalf',
    withholders: withholders(2),
    lossesCarriedForward: 6000,
    amounts: { '012': 25_000, '056': 1250 },
  };
  return deepMerge(base, overrides) as NoWithholding1322Appendix;
}

/**
 * A valid capital-gains appendix for securities without withholding, form 1326 (SPEC §7.2, record
 * 3066) with every header member set to a value that is written to the file and two codes (022,
 * 056). `overrides` are deep-merged into it.
 */
export function noWithholding1326Appendix(
  overrides: DeepPartial<NoWithholding1326Appendix> = {},
): NoWithholding1326Appendix {
  const base: NoWithholding1326Appendix = {
    symbol: 66,
    foreignAsset: true,
    withholdingStatus: 'notWithheldSecondHalf',
    lossesCarriedForward: 4000,
    amounts: { '022': 18_000, '056': 900 },
  };
  return deepMerge(base, overrides) as NoWithholding1326Appendix;
}

/**
 * A valid capital-gains appendix for shares (SPEC §7.2, record 3027) with every header member set
 * to a value that is written to the file (the three dates included) and four codes: 020 with
 * agorot (×100), the rate 018 and two whole-shekel amounts (015, 074). `overrides` are deep-merged
 * into it.
 */
export function sharesAppendix(overrides: DeepPartial<SharesAppendix> = {}): SharesAppendix {
  const base: SharesAppendix = {
    symbol: 27,
    expropriation: false,
    assetDetails: 'מניות חברה פרטית',
    assetLocation: 'abroad',
    relatedParty: true,
    buyerName: 'קונה בע"מ',
    dates: { code15: '2024-03-15', code20: '2015-06-01', code53: '2010-01-31' },
    amounts: { '015': 90_000, '018': 23, '020': 1234.56, '074': 5000 },
  };
  return deepMerge(base, overrides) as SharesAppendix;
}

/**
 * A valid capital-gains appendix for an asset sale under betterment tax (SPEC §7.2, record 3050)
 * with every header member set to a value that is written to the file and four codes (014, 015,
 * 016, 018). `overrides` are deep-merged into it.
 */
export function bettermentTaxAppendix(
  overrides: DeepPartial<BettermentTaxAppendix> = {},
): BettermentTaxAppendix {
  const base: BettermentTaxAppendix = {
    symbol: 50,
    expropriation: true,
    assetDetails: 'דירת מגורים',
    purchaseDate: '2012-04-01',
    dates: { code15: '2024-05-20' },
    amounts: { '014': 10, '015': 1_200_000, '016': 700_000, '018': 50 },
  };
  return deepMerge(base, overrides) as BettermentTaxAppendix;
}

/**
 * A valid capital-gains appendix for an oil-partnership asset (SPEC §7.2, record 3054) with every
 * header member set to a value that is written to the file and two codes (015, 016). `overrides`
 * are deep-merged into it.
 */
export function oilPartnershipAppendix(
  overrides: DeepPartial<OilPartnershipAppendix> = {},
): OilPartnershipAppendix {
  const base: OilPartnershipAppendix = {
    symbol: 54,
    assetDetails: 'יחידות השתתפות',
    purchaseDate: '2018-09-10',
    dates: { code15: '2024-08-01' },
    amounts: { '015': 40_000, '016': 25_000 },
  };
  return deepMerge(base, overrides) as OilPartnershipAppendix;
}

/**
 * A valid capital-gains appendix for a forced virtual-currency transaction (SPEC §7.2, record 3051)
 * with every header member set to a value that is written to the file (two wallet addresses) and
 * the required codes 071 (= 1) and 016 plus 015. `overrides` are deep-merged into it.
 */
export function forcedVirtualCurrencyAppendix(
  overrides: DeepPartial<ForcedVirtualCurrencyAppendix> = {},
): ForcedVirtualCurrencyAppendix {
  const base: ForcedVirtualCurrencyAppendix = {
    symbol: 51,
    assetDetails: 'ביטקוין',
    assetLocation: 'israel',
    relatedParty: false,
    buyerName: 'בורסת מטבעות',
    dates: { code15: '2024-12-31' },
    walletAddresses: ['bc1qwalletaddressone', 'bc1qwalletaddresstwo'],
    amounts: { '071': 1, '015': 80_000, '016': 30_000 },
  };
  return deepMerge(base, overrides) as ForcedVirtualCurrencyAppendix;
}

/** An improvement of a 3077 appendix (SPEC §7.2). */
export type Improvement = NonNullable<OtherTransactionsAppendix['improvements']>[number];

/**
 * `count` valid improvements of a 3077 appendix, canonical (SPEC §8.4): the i-th (0-based) has an
 * expense with agorot, an accumulated depreciation, a date in 201i and a code-50 amount with agorot.
 */
export function improvements(count: number): Improvement[] {
  return Array.from({ length: count }, (_, index) => ({
    expense: 10_000 * (index + 1) + 0.25,
    accumulatedDepreciation: 1000 * (index + 1),
    date: `201${index}-0${index + 1}-15`,
    code50Amount: 9000 * (index + 1) + 0.5,
  }));
}

/**
 * A valid capital-gains appendix for other transactions (SPEC §7.2, record 3077) with every header
 * member set to a value that is written to the file (two improvements, a replacement asset and one
 * wallet address) and three codes: 015, 020 with agorot (×100) and 071 = 1 (virtual currency, which
 * calls for the wallet address). `overrides` are deep-merged into it.
 */
export function otherTransactionsAppendix(
  overrides: DeepPartial<OtherTransactionsAppendix> = {},
): OtherTransactionsAppendix {
  const base: OtherTransactionsAppendix = {
    symbol: 77,
    expropriation: false,
    assetDetails: 'מבנה תעשייה',
    assetLocation: 'israel',
    relatedParty: true,
    buyerName: 'רוכש נכסים בע"מ',
    dates: { code15: '2024-07-01', code20: '2009-02-01' },
    improvements: improvements(2),
    replacementAsset: { details: 'מבנה חלופי', purchaseDate: '2024-09-01', price: 2_000_000 },
    walletAddresses: ['bc1qotherwalletone'],
    amounts: { '015': 3_000_000, '020': 1_500_000.5, '071': 1 },
  };
  return deepMerge(base, overrides) as OtherTransactionsAppendix;
}
