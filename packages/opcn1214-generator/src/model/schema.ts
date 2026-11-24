/**
 * Strict zod schemas of the public input (SPEC §7, §9.2 stage 2), mirroring `input.ts`. They check
 * JavaScript shape only: digit strings, phone prefixes and country codes are plain strings
 * and dates only need the ISO form, so the semantic field rules stay reachable for untyped callers.
 */
import { z } from 'zod';
import {
  CAPITAL_GAINS_CODES,
  CAPITAL_GAINS_INPUT_CODES,
  COUNTRY_BREAKDOWN_CODES,
  FOREIGN_APPENDIX_CODES,
  MAIN_FORM_INPUT_CODES,
} from './codes.generated.js';
import type { SupportedTaxYear } from './input.js';

/** `YYYY-MM-DD`; calendar validity is checked by field.date. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');

/** Any string: field.phonePrefix reports a prefix outside the allowed list. */
const phone = z.strictObject({
  prefix: z.string(),
  number: z.string(),
});

const company = z.strictObject({
  fileNumber: z.string(),
  registeredName: z.string(),
  withholdingFileNumber: z.string().optional(),
  vatFileNumber: z.string().optional(),
  occupationDescription: z.string().optional(),
  mailingAddress: z.string(),
  businessAddress: z.string(),
  booksAddress: z.string().optional(),
  email: z.string().optional(),
  phone,
  fax: phone.optional(),
});

const preparer = z.strictObject({
  officeName: z.string().optional(),
  contactName: z.string().optional(),
  name: z.string().optional(),
  profession: z.string().optional(),
  licensedDealerNumber: z.string().optional(),
  address: z.string().optional(),
  phone: phone.optional(),
});

const declarations = z.strictObject({
  hasTaxPlanningAction: z.boolean(),
  hadRelatedPartyTransactions: z.boolean(),
  controlsBodyOfPersons: z.boolean(),
  holdsRightsInBodyOfPersons: z.boolean(),
  appliesAccountingStandards: z.boolean(),
  directorsReceivedOpinion: z.boolean(),
  tookReportablePosition: z.boolean(),
  /** Any length: main.reportablePositions.max reports more than five. */
  reportablePositions: z.array(z.number().int()).optional(),
  form6111Obligation: z.enum(['obliged', 'notObliged', 'notRelevant']).optional(),
  financialStatementsAttached: z.boolean().optional(),
  familyCompany: z.strictObject({ representativeFileNumber: z.string() }).optional(),
  isHouseCompany: z.boolean().optional(),
  form1343Attached: z.boolean().optional(),
  form1344Attached: z.boolean().optional(),
  claimsCapitalInvestmentLawBenefits: z.boolean().optional(),
  preferredEnterprise: z.boolean().optional(),
  beneficiaryEnterprise: z.strictObject({ noticeDate: isoDate }).optional(),
  dividendDistributed: z.boolean().optional(),
  specialYear: z.strictObject({ balanceSheetDate: isoDate }).optional(),
  foreignInvestors: z.boolean().optional(),
  consolidatedReport: z
    .enum(['consolidatedUnderSection23', 'consolidatesWithParent', 'notRelevant'])
    .optional(),
  partnerInPartnership: z.boolean().optional(),
  isKibbutz: z.boolean().optional(),
  requestsAdvancePayments: z.boolean().optional(),
  hasBuildingIncome: z.boolean().optional(),
  isTrustBeneficiary: z.boolean().optional(),
  nonDeductibleSalaryExpenses: z.boolean().optional(),
  fewMembersCompany62A: z.boolean().optional(),
  partOfMultinationalGroup: z.boolean().optional(),
  noBankAccount: z.boolean().optional(),
  hasCapitalGainsAppendix: z.boolean().optional(),
});

const otherTaxableIncome = z.strictObject({
  source: z.string().optional(),
  amount: z.number().optional(),
  ratePercent: z.number().optional(),
});

const attachments = z.strictObject({
  donationReceiptsCount: z.number().optional(),
  withholdingCertificatesCount: z.number().optional(),
});

const capitalGainsSummary = z.strictObject({
  totalAppendicesCount: z.number().optional(),
  untransmittedCount: z.number().optional(),
  reasons: z
    .strictObject({
      lossOrNoGain: z.boolean().optional(),
      overFiveImprovementBalances: z.boolean().optional(),
      over14Appendices: z.boolean().optional(),
      other: z.boolean().optional(),
      otherText: z.string().optional(),
    })
    .optional(),
});

const qualifyingCompany = z.strictObject({
  purchased: z.boolean().optional(),
  israeliPurchaseAmount: z.number().optional(),
  foreignPurchaseAmount: z.number().optional(),
  amortizationClaimed: z.boolean().optional(),
  amortizationAmount: z.number().optional(),
});

const relatedCompany = z.strictObject({
  companyName: z.string(),
  companyFileNumber: z.string().optional(),
  relationType: z.enum([
    'parent',
    'subsidiary',
    'partnership',
    'kibbutzRelatedCorporation',
    'jointlyControlled',
    'granddaughter',
    'grandmother',
    'other',
  ]),
  assessingOfficeCode: z.number().optional(),
});

const rdInvestment = z.strictObject({
  companyName: z.string(),
  companyFileNumber: z.string().optional(),
  investmentAmount: z.number(),
});

/** Any string as `country`: foreign.breakdown.country.unknown checks it (SPEC §9.2). */
const countryBreakdown = z.strictObject({
  deductionsOffsetsAndExemptions: z.number().optional(),
  /** Any length: foreign.breakdown.countries.min / .max count them. */
  countries: z.array(z.strictObject({ country: z.string(), income: z.number() })),
});

const foreignAppendix = z.strictObject({
  otherTaxableIncomeDescription: z.string().optional(),
  otherTaxableIncome: z.number().optional(),
  foreignTaxPaidOnOtherIncome: z.number().optional(),
  totalForeignTaxableIncome: z.number().optional(),
  totalForeignLoss: z.number().optional(),
  participationExemptionHoldingCompany: z.number().optional(),
  taxRefundDeclaration: z.boolean(),
  taxRefundDeclarationAmount: z.number().optional(),
  amounts: z.partialRecord(z.enum(FOREIGN_APPENDIX_CODES), z.number().optional()),
  countryBreakdown: z
    .partialRecord(z.enum(COUNTRY_BREAKDOWN_CODES), countryBreakdown.optional())
    .optional(),
});

/** Record 3063 (SPEC §7.2). */
const section6SecuritiesAppendix = z.strictObject({
  symbol: z.literal(63),
  foreignAsset: z.boolean().optional(),
  lossesCarriedForward: z.number().optional(),
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[63]), z.number().optional()),
});

/** A withholding agent of records 3060/3064/3065 (SPEC §7.2); field rules check the values. */
const withholder = z.strictObject({
  name: z.string().optional(),
  branch: z.string().optional(),
  account: z.string().optional(),
});

/** The header members shared by records 3060, 3064 and 3065 (SPEC §7.2 SecuritiesAppendix). */
const securitiesHeader = {
  foreignAsset: z.boolean().optional(),
  soldToRelatedParty: z.boolean().optional(),
  boughtFromRelatedParty: z.boolean().optional(),
  gainFromInvestmentFund: z.boolean().optional(),
  /** Four slots in the record (3060/3064: 146–313, 3065: 147–314): a fifth withholder is input.shape. */
  withholders: z.array(withholder).max(4).optional(),
  lossesCarriedForward: z.number().optional(),
};

/** Record 3060 (SPEC §7.2). */
const securitiesAppendix = z.strictObject({
  symbol: z.literal(60),
  ...securitiesHeader,
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[60]), z.number().optional()),
});

/** Record 3064 (SPEC §7.2). */
const reitAppendix = z.strictObject({
  symbol: z.literal(64),
  ...securitiesHeader,
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[64]), z.number().optional()),
});

/** "מס במקור" of records 3065 and 3066 (SPEC §7.2). */
const withholdingStatus = z.enum(['notWithheldFirstHalf', 'notWithheldSecondHalf']).optional();

/** Record 3065 (SPEC §7.2). */
const noWithholding1322Appendix = z.strictObject({
  symbol: z.literal(65),
  ...securitiesHeader,
  withholdingStatus,
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[65]), z.number().optional()),
});

/** Record 3066 (SPEC §7.2). */
const noWithholding1326Appendix = z.strictObject({
  symbol: z.literal(66),
  foreignAsset: z.boolean().optional(),
  withholdingStatus,
  lossesCarriedForward: z.number().optional(),
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[66]), z.number().optional()),
});

/** "מקום הנכס" of records 3027 and 3051 (SPEC §7.2). */
const assetLocation = z.enum(['abroad', 'israel']).optional();

/** The date of code 15, required in records 3050, 3051 and 3054 (SPEC §7.2). */
const requiredCode15Date = z.strictObject({ code15: isoDate });

/** Record 3027 (SPEC §7.2); every date is optional. */
const sharesAppendix = z.strictObject({
  symbol: z.literal(27),
  expropriation: z.boolean().optional(),
  assetDetails: z.string().optional(),
  assetLocation,
  relatedParty: z.boolean().optional(),
  buyerName: z.string().optional(),
  dates: z
    .strictObject({
      code15: isoDate.optional(),
      code20: isoDate.optional(),
      code53: isoDate.optional(),
    })
    .optional(),
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[27]), z.number().optional()),
});

/** Record 3050 (SPEC §7.2). */
const bettermentTaxAppendix = z.strictObject({
  symbol: z.literal(50),
  expropriation: z.boolean().optional(),
  assetDetails: z.string().optional(),
  purchaseDate: isoDate,
  dates: requiredCode15Date,
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[50]), z.number().optional()),
});

/** Record 3051 (SPEC §7.2); field rules check the wallet addresses' lengths. */
const forcedVirtualCurrencyAppendix = z.strictObject({
  symbol: z.literal(51),
  assetDetails: z.string().optional(),
  assetLocation,
  relatedParty: z.boolean().optional(),
  buyerName: z.string().optional(),
  dates: requiredCode15Date,
  /** Two slots in the record (236, 386): a third address is input.shape. */
  walletAddresses: z.array(z.string()).min(1).max(2).optional(),
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[51]), z.number().optional()),
});

/** Record 3054 (SPEC §7.2). */
const oilPartnershipAppendix = z.strictObject({
  symbol: z.literal(54),
  assetDetails: z.string().optional(),
  purchaseDate: isoDate,
  dates: requiredCode15Date,
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_CODES[54]), z.number().optional()),
});

/** Record 3077 (SPEC §7.2); field rules check the wallet addresses' lengths. */
const otherTransactionsAppendix = z.strictObject({
  symbol: z.literal(77),
  expropriation: z.boolean().optional(),
  assetDetails: z.string().optional(),
  assetLocation,
  relatedParty: z.boolean().optional(),
  buyerName: z.string().optional(),
  dates: z.strictObject({ code15: isoDate, code20: isoDate }),
  /** Any length: cg.improvements.max reports more than five. */
  improvements: z
    .array(
      z.strictObject({
        expense: z.number().optional(),
        accumulatedDepreciation: z.number().optional(),
        date: isoDate,
        code50Amount: z.number().optional(),
      }),
    )
    .optional(),
  replacementAsset: z
    .strictObject({
      details: z.string().optional(),
      purchaseDate: isoDate.optional(),
      price: z.number().optional(),
    })
    .optional(),
  /** Two slots in the record (489, 639): a third address is input.shape. */
  walletAddresses: z.array(z.string()).min(1).max(2).optional(),
  /** The input codes of record 3077: its codes without the derived 501–505 (SPEC §7.4). */
  amounts: z.partialRecord(z.enum(CAPITAL_GAINS_INPUT_CODES[77]), z.number().optional()),
});

/** A capital-gains appendix, discriminated by its transaction symbol (SPEC §3.7). */
const capitalGainsAppendix = z.discriminatedUnion('symbol', [
  sharesAppendix,
  bettermentTaxAppendix,
  forcedVirtualCurrencyAppendix,
  oilPartnershipAppendix,
  securitiesAppendix,
  section6SecuritiesAppendix,
  reitAppendix,
  noWithholding1322Appendix,
  noWithholding1326Appendix,
  otherTransactionsAppendix,
]);

const shareholder = z.strictObject({
  idNumber: z.string(),
  fullName: z.string(),
  isControllingShareholder: z.boolean(),
  dividendRightsPercent: z.number().optional(),
  votingRightsPercent: z.number().optional(),
  otherRightsPercent: z.number().optional(),
  isMaterialShareholder: z.boolean().optional(),
  salaryMonths1To9: z.number().optional(),
  salaryMonths10To12: z.number().optional(),
  otherPayments: z.number().optional(),
});

/** The schema of a `Report1214Input` (SPEC §7.2); one schema serves every supported year today. */
export const report1214InputSchema = z.strictObject({
  taxYear: z.literal([2024, 2025]),
  meta: z
    .strictObject({
      softwareName: z.string().optional(),
      saveDate: isoDate.optional(),
    })
    .optional(),
  company,
  preparer: preparer.optional(),
  declarations,
  otherTaxableIncome: otherTaxableIncome.optional(),
  attachments: attachments.optional(),
  capitalGainsSummary: capitalGainsSummary.optional(),
  qualifyingCompany: qualifyingCompany.optional(),
  /** Any strings: main.bankAccount.format checks the digits. */
  bankAccount: z
    .strictObject({ bank: z.string(), branch: z.string(), account: z.string() })
    .optional(),
  amounts: z.partialRecord(z.enum(MAIN_FORM_INPUT_CODES), z.number().optional()),
  /** Any length: struct.relatedCompanies.max reports more than three. */
  relatedCompanies: z.array(relatedCompany).optional(),
  shareholders: z.array(shareholder),
  /** Any length: struct.rdInvestments.max reports more than five. */
  rdInvestments: z.array(rdInvestment).optional(),
  foreignAppendix: foreignAppendix.optional(),
  /** Any length: struct.capitalGains.max reports more than fourteen. */
  capitalGains: z.array(capitalGainsAppendix).optional(),
});

/** The input schema of `taxYear` (SPEC §9.2: the schema is per year). */
export function schemaFor(_taxYear: SupportedTaxYear): typeof report1214InputSchema {
  return report1214InputSchema;
}
