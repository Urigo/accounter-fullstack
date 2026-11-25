import { GraphQLError } from 'graphql';
import {
  getLayout,
  supportedTaxYears,
  type Declarations,
  type Phone,
  type PhonePrefix,
  type RelatedCompany,
} from '@accounter/opcn1214-generator';
import type {
  Report1214AmountOverride,
  Report1214AmountOverrideInput,
  Report1214AttachmentsInput,
  Report1214BankAccountInput,
  Report1214CapitalGainsSummaryInput,
  Report1214CompanyOverridesInput,
  Report1214ConsolidatedReport,
  Report1214Declarations,
  Report1214DeclarationsInput,
  Report1214Form6111Obligation,
  Report1214OtherTaxableIncomeInput,
  Report1214PhoneInput,
  Report1214PreparerInput,
  Report1214ProfileInput,
  Report1214QualifyingCompanyInput,
  Report1214RdInvestmentInput,
  Report1214RelatedCompany,
  Report1214RelatedCompanyInput,
  Report1214RelatedCompanyRelationType,
} from '../../../__generated__/types.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type {
  IGetReport1214ProfilesByOwnerAndYearsResult,
  Report1214AmountOverridesData,
  Report1214AttachmentsData,
  Report1214BankAccountData,
  Report1214CapitalGainsSummaryData,
  Report1214CompanyOverridesData,
  Report1214DeclarationsData,
  Report1214OtherTaxableIncomeData,
  Report1214PreparerData,
  Report1214ProfileProto,
  Report1214QualifyingCompanyData,
  Report1214RdInvestmentData,
  Report1214RelatedCompanyData,
} from '../types.js';

/**
 * Most items stored in one profile list. This is a size limit against oversized payloads only: the
 * form's own limits (3 related companies, 5 R&D investments, 5 reportable positions) are reported
 * by the generator's validation (`struct.relatedCompanies.max`, `struct.rdInvestments.max`,
 * `main.reportablePositions.max`), so a draft over them can still be saved and shown.
 */
export const MAX_PROFILE_LIST_ITEMS = 50;
/** Longest free text stored; the generator reports its own, shorter field limits. */
export const MAX_PROFILE_TEXT_LENGTH = 200;

type Maybe<T> = T | null | undefined;

/** `true` when type `T` is `never`; used for compile-time drift checks against the generator. */
type AssertNever<T extends never> = T;

/**
 * Phone prefixes form 1214 allows. The generator keeps the list (`PHONE_PREFIXES`) internal, so it
 * is repeated here; `satisfies` and the check below make TypeScript fail on any drift.
 */
export const REPORT_1214_PHONE_PREFIXES = [
  '02',
  '03',
  '04',
  '08',
  '09',
  '072',
  '073',
  '074',
  '076',
  '077',
  '050',
  '052',
  '053',
  '054',
  '055',
  '057',
  '058',
  '059',
] as const satisfies readonly PhonePrefix[];
export type _PhonePrefixesCovered = AssertNever<
  Exclude<PhonePrefix, (typeof REPORT_1214_PHONE_PREFIXES)[number]>
>;
const PHONE_PREFIX_SET: ReadonlySet<string> = new Set(REPORT_1214_PHONE_PREFIXES);

/** The yes/no and flag members of `Declarations`, copied as is. */
const DECLARATION_BOOLEAN_KEYS = [
  'hasTaxPlanningAction',
  'hadRelatedPartyTransactions',
  'controlsBodyOfPersons',
  'holdsRightsInBodyOfPersons',
  'appliesAccountingStandards',
  'directorsReceivedOpinion',
  'tookReportablePosition',
  'financialStatementsAttached',
  'isHouseCompany',
  'form1343Attached',
  'form1344Attached',
  'claimsCapitalInvestmentLawBenefits',
  'preferredEnterprise',
  'dividendDistributed',
  'foreignInvestors',
  'partnerInPartnership',
  'isKibbutz',
  'requestsAdvancePayments',
  'hasBuildingIncome',
  'isTrustBeneficiary',
  'nonDeductibleSalaryExpenses',
  'fewMembersCompany62A',
  'partOfMultinationalGroup',
  'noBankAccount',
  'hasCapitalGainsAppendix',
] as const satisfies ReadonlyArray<keyof Declarations>;
type BooleanKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends boolean ? K : never;
}[keyof T];
export type _DeclarationBooleansCovered = AssertNever<
  Exclude<BooleanKeys<Declarations>, (typeof DECLARATION_BOOLEAN_KEYS)[number]>
>;

/**
 * A two-way converter between a GraphQL enum and the generator's string union. The maps are
 * total in both directions (checked at compile time where they are declared).
 */
function enumConverter<Gql extends string, Stored extends string>(map: Record<Gql, Stored>) {
  const reverse = new Map<string, Gql>(
    (Object.entries(map) as Array<[Gql, Stored]>).map(([gql, stored]) => [stored, gql]),
  );
  return {
    toStored: (value: Gql): Stored => map[value],
    /** Unknown stored values (not written by this API) read back as `null`. */
    toGql: (value: unknown): Gql | null =>
      typeof value === 'string' ? (reverse.get(value) ?? null) : null,
  };
}

type StoredForm6111Obligation = NonNullable<Declarations['form6111Obligation']>;
const FORM_6111_OBLIGATION_MAP = {
  OBLIGED: 'obliged',
  NOT_OBLIGED: 'notObliged',
  NOT_RELEVANT: 'notRelevant',
} as const satisfies Record<Report1214Form6111Obligation, StoredForm6111Obligation>;
export type _Form6111ObligationCovered = AssertNever<
  Exclude<StoredForm6111Obligation, (typeof FORM_6111_OBLIGATION_MAP)[Report1214Form6111Obligation]>
>;
export const form6111Obligation = enumConverter<
  Report1214Form6111Obligation,
  StoredForm6111Obligation
>(FORM_6111_OBLIGATION_MAP);

type StoredConsolidatedReport = NonNullable<Declarations['consolidatedReport']>;
const CONSOLIDATED_REPORT_MAP = {
  CONSOLIDATED_UNDER_SECTION_23: 'consolidatedUnderSection23',
  CONSOLIDATES_WITH_PARENT: 'consolidatesWithParent',
  NOT_RELEVANT: 'notRelevant',
} as const satisfies Record<Report1214ConsolidatedReport, StoredConsolidatedReport>;
export type _ConsolidatedReportCovered = AssertNever<
  Exclude<StoredConsolidatedReport, (typeof CONSOLIDATED_REPORT_MAP)[Report1214ConsolidatedReport]>
>;
export const consolidatedReport = enumConverter<
  Report1214ConsolidatedReport,
  StoredConsolidatedReport
>(CONSOLIDATED_REPORT_MAP);

type StoredRelationType = RelatedCompany['relationType'];
const RELATION_TYPE_MAP = {
  PARENT: 'parent',
  SUBSIDIARY: 'subsidiary',
  PARTNERSHIP: 'partnership',
  KIBBUTZ_RELATED_CORPORATION: 'kibbutzRelatedCorporation',
  JOINTLY_CONTROLLED: 'jointlyControlled',
  GRANDDAUGHTER: 'granddaughter',
  GRANDMOTHER: 'grandmother',
  OTHER: 'other',
} as const satisfies Record<Report1214RelatedCompanyRelationType, StoredRelationType>;
export type _RelationTypeCovered = AssertNever<
  Exclude<StoredRelationType, (typeof RELATION_TYPE_MAP)[Report1214RelatedCompanyRelationType]>
>;
export const relatedCompanyRelationType = enumConverter<
  Report1214RelatedCompanyRelationType,
  StoredRelationType
>(RELATION_TYPE_MAP);

function badUserInput(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

/** Throws `BAD_USER_INPUT` when a list is over the stored size limit (not a form limit). */
function assertListSize(length: number, path: string): void {
  if (length > MAX_PROFILE_LIST_ITEMS) {
    throw badUserInput(
      `${path} exceeds the size limit of ${MAX_PROFILE_LIST_ITEMS} items (got ${length})`,
    );
  }
}

/** Drops the `undefined` members, so stored JSON carries only what is set. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, member]) => member !== undefined),
  ) as T;
}

/** Trimmed text; empty → unset. */
function normalizeText(
  value: Maybe<string>,
  path: string,
  maxLength = MAX_PROFILE_TEXT_LENGTH,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > maxLength) {
    throw badUserInput(`${path} must be at most ${maxLength} characters (got ${trimmed.length})`);
  }
  return trimmed;
}

/** Trimmed digit string of `min`-`max` digits; empty → unset. */
function normalizeDigits(
  value: Maybe<string>,
  path: string,
  min: number,
  max: number,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!new RegExp(`^\\d{${min},${max}}$`).test(trimmed)) {
    const expected = min === max ? `exactly ${min}` : `${min} to ${max}`;
    throw badUserInput(`${path} must be ${expected} digits (got "${trimmed}")`);
  }
  return trimmed;
}

/** Requires a present digit string (for members the generator type requires). */
function requireDigits(value: string, path: string, min: number, max: number): string {
  const digits = normalizeDigits(value, path, min, max);
  if (digits === undefined) {
    throw badUserInput(`${path} is required`);
  }
  return digits;
}

function normalizeFinite(value: Maybe<number>, path: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    throw badUserInput(`${path} must be a finite number`);
  }
  return value;
}

function normalizeCount(value: Maybe<number>, path: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw badUserInput(`${path} must be a non-negative integer (got ${value})`);
  }
  return value;
}

function normalizeBoolean(value: Maybe<boolean>): boolean | undefined {
  return value ?? undefined;
}

/** A phone or fax: the prefix must be one form 1214 allows, the number exactly 7 digits. */
export function normalizePhone(
  value: Maybe<Report1214PhoneInput>,
  path: string,
): Phone | undefined {
  if (value == null) {
    return undefined;
  }
  const prefix = value.prefix.trim();
  if (!PHONE_PREFIX_SET.has(prefix)) {
    throw badUserInput(
      `${path}.prefix must be one of ${REPORT_1214_PHONE_PREFIXES.join(', ')} (got "${prefix}")`,
    );
  }
  const number = value.number.trim();
  if (!/^\d{7}$/.test(number)) {
    throw badUserInput(`${path}.number must be exactly 7 digits (got "${number}")`);
  }
  return { prefix: prefix as PhonePrefix, number };
}

export function normalizeCompanyOverrides(
  input: Report1214CompanyOverridesInput,
): Report1214CompanyOverridesData {
  return compact({
    registeredName: normalizeText(input.registeredName, 'company.registeredName'),
    phone: normalizePhone(input.phone, 'company.phone'),
    fax: normalizePhone(input.fax, 'company.fax'),
    email: normalizeText(input.email, 'company.email'),
    occupationDescription: normalizeText(
      input.occupationDescription,
      'company.occupationDescription',
    ),
    mailingAddress: normalizeText(input.mailingAddress, 'company.mailingAddress'),
    businessAddress: normalizeText(input.businessAddress, 'company.businessAddress'),
    booksAddress: normalizeText(input.booksAddress, 'company.booksAddress'),
    withholdingFileNumber: normalizeDigits(
      input.withholdingFileNumber,
      'company.withholdingFileNumber',
      1,
      9,
    ),
  });
}

export function normalizeDeclarations(
  input: Report1214DeclarationsInput,
): Report1214DeclarationsData {
  const declarations: Report1214DeclarationsData = {};
  for (const key of DECLARATION_BOOLEAN_KEYS) {
    const value = normalizeBoolean(input[key]);
    if (value !== undefined) {
      declarations[key] = value;
    }
  }

  if (input.reportablePositions != null) {
    assertListSize(input.reportablePositions.length, 'declarations.reportablePositions');
    for (const [index, position] of input.reportablePositions.entries()) {
      if (!Number.isInteger(position) || position < 1 || position > 999) {
        throw badUserInput(
          `declarations.reportablePositions[${index}] must be an integer between 1 and 999 (got ${position})`,
        );
      }
    }
    declarations.reportablePositions = [...input.reportablePositions];
  }
  if (input.form6111Obligation != null) {
    declarations.form6111Obligation = form6111Obligation.toStored(input.form6111Obligation);
  }
  if (input.consolidatedReport != null) {
    declarations.consolidatedReport = consolidatedReport.toStored(input.consolidatedReport);
  }
  if (input.familyCompany != null) {
    declarations.familyCompany = {
      representativeFileNumber: requireDigits(
        input.familyCompany.representativeFileNumber,
        'declarations.familyCompany.representativeFileNumber',
        1,
        9,
      ),
    };
  }
  if (input.beneficiaryEnterprise != null) {
    declarations.beneficiaryEnterprise = { noticeDate: input.beneficiaryEnterprise.noticeDate };
  }
  if (input.specialYear != null) {
    declarations.specialYear = { balanceSheetDate: input.specialYear.balanceSheetDate };
  }
  return declarations;
}

export function normalizePreparer(input: Report1214PreparerInput): Report1214PreparerData {
  return compact({
    officeName: normalizeText(input.officeName, 'preparer.officeName'),
    contactName: normalizeText(input.contactName, 'preparer.contactName'),
    name: normalizeText(input.name, 'preparer.name'),
    profession: normalizeText(input.profession, 'preparer.profession'),
    licensedDealerNumber: normalizeDigits(
      input.licensedDealerNumber,
      'preparer.licensedDealerNumber',
      1,
      9,
    ),
    address: normalizeText(input.address, 'preparer.address'),
    phone: normalizePhone(input.phone, 'preparer.phone'),
  });
}

function normalizeAttachments(input: Report1214AttachmentsInput): Report1214AttachmentsData {
  return compact({
    donationReceiptsCount: normalizeCount(
      input.donationReceiptsCount,
      'attachments.donationReceiptsCount',
    ),
    withholdingCertificatesCount: normalizeCount(
      input.withholdingCertificatesCount,
      'attachments.withholdingCertificatesCount',
    ),
  });
}

function normalizeBankAccount(input: Report1214BankAccountInput): Report1214BankAccountData {
  return {
    bank: requireDigits(input.bank, 'bankAccount.bank', 2, 2),
    branch: requireDigits(input.branch, 'bankAccount.branch', 3, 3),
    account: requireDigits(input.account, 'bankAccount.account', 1, 9),
  };
}

function normalizeOtherTaxableIncome(
  input: Report1214OtherTaxableIncomeInput,
): Report1214OtherTaxableIncomeData {
  return compact({
    source: normalizeText(input.source, 'otherTaxableIncome.source'),
    amount: normalizeFinite(input.amount, 'otherTaxableIncome.amount'),
    ratePercent: normalizeFinite(input.ratePercent, 'otherTaxableIncome.ratePercent'),
  });
}

function normalizeCapitalGainsSummary(
  input: Report1214CapitalGainsSummaryInput,
): Report1214CapitalGainsSummaryData {
  const reasons =
    input.reasons == null
      ? undefined
      : compact({
          lossOrNoGain: normalizeBoolean(input.reasons.lossOrNoGain),
          overFiveImprovementBalances: normalizeBoolean(input.reasons.overFiveImprovementBalances),
          over14Appendices: normalizeBoolean(input.reasons.over14Appendices),
          other: normalizeBoolean(input.reasons.other),
          otherText: normalizeText(
            input.reasons.otherText,
            'capitalGainsSummary.reasons.otherText',
          ),
        });
  return compact({
    totalAppendicesCount: normalizeCount(
      input.totalAppendicesCount,
      'capitalGainsSummary.totalAppendicesCount',
    ),
    untransmittedCount: normalizeCount(
      input.untransmittedCount,
      'capitalGainsSummary.untransmittedCount',
    ),
    reasons: reasons && Object.keys(reasons).length > 0 ? reasons : undefined,
  });
}

function normalizeQualifyingCompany(
  input: Report1214QualifyingCompanyInput,
): Report1214QualifyingCompanyData {
  return compact({
    purchased: normalizeBoolean(input.purchased),
    israeliPurchaseAmount: normalizeFinite(
      input.israeliPurchaseAmount,
      'qualifyingCompany.israeliPurchaseAmount',
    ),
    foreignPurchaseAmount: normalizeFinite(
      input.foreignPurchaseAmount,
      'qualifyingCompany.foreignPurchaseAmount',
    ),
    amortizationClaimed: normalizeBoolean(input.amortizationClaimed),
    amortizationAmount: normalizeFinite(
      input.amortizationAmount,
      'qualifyingCompany.amortizationAmount',
    ),
  });
}

function requireText(value: string, path: string): string {
  const text = normalizeText(value, path);
  if (text === undefined) {
    throw badUserInput(`${path} is required`);
  }
  return text;
}

function normalizeRelatedCompanies(
  rows: ReadonlyArray<Report1214RelatedCompanyInput>,
): Report1214RelatedCompanyData[] {
  assertListSize(rows.length, 'relatedCompanies');
  return rows.map((row, index) => {
    const path = `relatedCompanies[${index}]`;
    return compact({
      companyName: requireText(row.companyName, `${path}.companyName`),
      companyFileNumber: normalizeDigits(row.companyFileNumber, `${path}.companyFileNumber`, 1, 9),
      relationType: relatedCompanyRelationType.toStored(row.relationType),
      assessingOfficeCode: normalizeCount(row.assessingOfficeCode, `${path}.assessingOfficeCode`),
    });
  });
}

function normalizeRdInvestments(
  rows: ReadonlyArray<Report1214RdInvestmentInput>,
): Report1214RdInvestmentData[] {
  assertListSize(rows.length, 'rdInvestments');
  return rows.map((row, index) => {
    const path = `rdInvestments[${index}]`;
    const investmentAmount = normalizeFinite(row.investmentAmount, `${path}.investmentAmount`);
    return compact({
      companyName: requireText(row.companyName, `${path}.companyName`),
      companyFileNumber: normalizeDigits(row.companyFileNumber, `${path}.companyFileNumber`, 1, 9),
      investmentAmount: investmentAmount!,
    });
  });
}

/**
 * The record 1000 codes an amount override may use for `year`: the input (non-derived) codes of
 * the year's layout. A year without a layout uses the latest supported one, so a profile can be
 * prepared before the generator supports its year.
 */
export function amountOverrideCodes(year: number): {
  layoutYear: number;
  inputCodes: ReadonlySet<string>;
  derivedCodes: ReadonlySet<string>;
} {
  const supported = supportedTaxYears();
  const layoutYear = supported.includes(year) ? year : supported.at(-1)!;
  const codes = getLayout(layoutYear).records['1000'].codes;
  return {
    layoutYear,
    inputCodes: new Set(codes.filter(def => !def.derived).map(def => def.code)),
    derivedCodes: new Set(codes.filter(def => def.derived).map(def => def.code)),
  };
}

export function normalizeAmountOverrides(
  rows: ReadonlyArray<Report1214AmountOverrideInput>,
  year: number,
): Report1214AmountOverridesData {
  const { layoutYear, inputCodes, derivedCodes } = amountOverrideCodes(year);
  const overrides: Record<string, number> = {};
  for (const [index, row] of rows.entries()) {
    const path = `amountOverrides[${index}]`;
    const code = row.code.trim();
    if (derivedCodes.has(code)) {
      throw badUserInput(
        `${path}: code ${code} is derived by the report from other data and cannot be overridden`,
      );
    }
    if (!inputCodes.has(code)) {
      throw badUserInput(
        `${path}: "${code}" is not a record 1000 input code of the ${layoutYear} layout`,
      );
    }
    if (code in overrides) {
      throw badUserInput(`${path}: code ${code} appears more than once`);
    }
    if (!Number.isFinite(row.amount)) {
      throw badUserInput(`${path}: the amount of code ${code} must be a finite number`);
    }
    overrides[code] = row.amount;
  }
  return overrides as Report1214AmountOverridesData;
}

/**
 * The blocks of an `updateReport1214Profile` call, ready to store: `undefined` keeps the stored
 * block, any other value replaces it (`{}` / `[]` for a block cleared with an explicit `null`).
 */
export type Report1214ProfilePatch = {
  company?: Report1214CompanyOverridesData;
  declarations?: Report1214DeclarationsData;
  preparer?: Report1214PreparerData;
  attachments?: Report1214AttachmentsData;
  bankAccount?: Partial<Report1214BankAccountData>;
  otherTaxableIncome?: Report1214OtherTaxableIncomeData;
  capitalGainsSummary?: Report1214CapitalGainsSummaryData;
  qualifyingCompany?: Report1214QualifyingCompanyData;
  relatedCompanies?: Report1214RelatedCompanyData[];
  rdInvestments?: Report1214RdInvestmentData[];
  amountOverrides?: Report1214AmountOverridesData;
};

/** Omitted → keep (`undefined`), `null` → `empty`, a value → its normalized form. */
function block<In, Out>(value: Maybe<In>, empty: Out, normalize: (value: In) => Out) {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? empty : normalize(value);
}

/**
 * Validates and normalizes an `updateReport1214Profile` input before anything reaches the
 * database. Errors are `BAD_USER_INPUT` naming the offending path.
 *
 * Only shape and format are checked (phone prefixes and digits, digit-only file numbers, a size
 * limit of 50 items per list, known non-derived amount codes, text up to 200 characters). Strings are trimmed and
 * empty ones dropped; unset members are left out of the stored JSON. The form's business rules are
 * reported by the 1214 generator's validation.
 */
export function normalizeReport1214ProfileInput(
  input: Report1214ProfileInput,
  year: number,
): Report1214ProfilePatch {
  return compact({
    company: block(input.company, {}, normalizeCompanyOverrides),
    declarations: block(input.declarations, {}, normalizeDeclarations),
    preparer: block(input.preparer, {}, normalizePreparer),
    attachments: block(input.attachments, {}, normalizeAttachments),
    bankAccount: block<Report1214BankAccountInput, Partial<Report1214BankAccountData>>(
      input.bankAccount,
      {},
      normalizeBankAccount,
    ),
    otherTaxableIncome: block(input.otherTaxableIncome, {}, normalizeOtherTaxableIncome),
    capitalGainsSummary: block(input.capitalGainsSummary, {}, normalizeCapitalGainsSummary),
    qualifyingCompany: block(input.qualifyingCompany, {}, normalizeQualifyingCompany),
    relatedCompanies: block(input.relatedCompanies, [], normalizeRelatedCompanies),
    rdInvestments: block(input.rdInvestments, [], normalizeRdInvestments),
    amountOverrides: block(input.amountOverrides, {}, rows => normalizeAmountOverrides(rows, year)),
  });
}

function asObject<T extends object>(value: unknown): T {
  return (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as T;
}

function asArray<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : []) as T[];
}

/** Maps a `report_1214_profiles` row (or its absence) to the GraphQL `Report1214Profile` parent. */
export function mapReport1214ProfileRow(
  row: IGetReport1214ProfilesByOwnerAndYearsResult | null,
  ownerId: string,
  year: number,
): Report1214ProfileProto {
  return {
    ownerId: row?.owner_id ?? ownerId,
    year: row?.year ?? year,
    company: asObject(row?.company),
    declarations: asObject(row?.declarations),
    preparer: asObject(row?.preparer),
    attachments: asObject(row?.attachments),
    bankAccount: asObject(row?.bank_account),
    otherTaxableIncome: asObject(row?.other_taxable_income),
    capitalGainsSummary: asObject(row?.capital_gains_summary),
    qualifyingCompany: asObject(row?.qualifying_company),
    relatedCompanies: asArray(row?.related_companies),
    rdInvestments: asArray(row?.rd_investments),
    amountOverrides: asObject(row?.amount_overrides),
    updatedAt: row?.updated_at ?? null,
  };
}

/** `null` for an empty (unset) block, the block otherwise. */
export function emptyToNull<T extends object>(value: T): T | null {
  return Object.keys(value).length === 0 ? null : value;
}

/** Stored declarations → GraphQL `Report1214Declarations` (enums converted). */
export function declarationsToGql(stored: Report1214DeclarationsData): Report1214Declarations {
  const { form6111Obligation: obligation, consolidatedReport: consolidated, ...rest } = stored;
  return {
    ...rest,
    beneficiaryEnterprise: stored.beneficiaryEnterprise
      ? { noticeDate: stored.beneficiaryEnterprise.noticeDate as TimelessDateString }
      : null,
    specialYear: stored.specialYear
      ? { balanceSheetDate: stored.specialYear.balanceSheetDate as TimelessDateString }
      : null,
    form6111Obligation: form6111Obligation.toGql(obligation),
    consolidatedReport: consolidatedReport.toGql(consolidated),
  };
}

/** Stored related companies → GraphQL; a row with an unknown relation type is skipped. */
export function relatedCompaniesToGql(
  stored: ReadonlyArray<Report1214RelatedCompanyData>,
): Report1214RelatedCompany[] {
  return stored.flatMap(company => {
    const relationType = relatedCompanyRelationType.toGql(company.relationType);
    return relationType ? [{ ...company, relationType }] : [];
  });
}

/** Stored amount overrides → GraphQL list, by code. */
export function amountOverridesToGql(
  stored: Report1214AmountOverridesData,
): Report1214AmountOverride[] {
  return Object.entries(stored)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, amount]) => ({ code, amount }));
}

/** A complete stored bank account, or `null`. */
export function bankAccountToGql(
  stored: Partial<Report1214BankAccountData>,
): Report1214BankAccountData | null {
  const { bank, branch, account } = stored;
  return bank && branch && account ? { bank, branch, account } : null;
}

const PG_INSUFFICIENT_PRIVILEGE = '42501';
const PG_CHECK_VIOLATION = '23514';

/**
 * Turns the database errors a profile write can hit into GraphQL errors the caller can act on.
 * Anything else is rethrown as is.
 */
export function translateReport1214ProfileWriteError(
  error: unknown,
  ownerId: string,
  year: number,
): unknown {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case PG_CHECK_VIOLATION:
      return new GraphQLError('A form 1214 profile value is out of range', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    case PG_INSUFFICIENT_PRIVILEGE:
      return new GraphQLError(
        `Not authorized to change the form 1214 profile of business ${ownerId} for ${year}`,
        { extensions: { code: 'FORBIDDEN' } },
      );
    default:
      return error;
  }
}
