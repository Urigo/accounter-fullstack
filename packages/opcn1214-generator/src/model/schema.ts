/**
 * Strict zod schemas of the public input (SPEC §7, §9.2 stage 2), mirroring `input.ts`. They check
 * JavaScript shape only: digit strings, phone prefixes and (later) country codes are plain strings
 * and dates only need the ISO form, so the semantic field rules stay reachable for untyped callers.
 */
import { z } from 'zod';
import { MAIN_FORM_INPUT_CODES } from './codes.generated.js';
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
});

/** The input schema of `taxYear` (SPEC §9.2: the schema is per year). */
export function schemaFor(_taxYear: SupportedTaxYear): typeof report1214InputSchema {
  return report1214InputSchema;
}
