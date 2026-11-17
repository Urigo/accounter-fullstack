/**
 * Input builders for tests. `minimalInput()` is the smallest fileable report: it must stay valid
 * against EVERY rule of SPEC §10 (no errors and no warnings); later steps rely on that, so any
 * change here has to keep it so.
 */
import { COUNTRY_CODES } from '../../src/model/codes.generated.js';
import type {
  CountryBreakdown,
  CountryIncome,
  ForeignAppendix,
  RdInvestment,
  ReitAppendix,
  RelatedCompany,
  Report1214Input,
  Section6SecuritiesAppendix,
  SecuritiesAppendix,
  Withholder,
} from '../../src/model/input.js';

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
      licensedDealerNumber: '012345678',
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
    companyFileNumber: String(510_000_001 + index),
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
    companyFileNumber: String(520_000_001 + index),
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
