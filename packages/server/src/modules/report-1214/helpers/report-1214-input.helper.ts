import type { Injector } from 'graphql-modules';
import {
  supportedTaxYears,
  type CompanyDetails,
  type Declarations,
  type Phone,
  type PhonePrefix,
  type Report1214Input,
  type Shareholder,
  type SupportedTaxYear,
} from '@accounter/opcn1214-generator';
import { AdminBusinessesProvider } from '../../financial-entities/providers/admin-businesses.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import type {
  IGetAdminBusinessesByIdsResult,
  IGetBusinessesByIdsResult,
} from '../../financial-entities/types.js';
import {
  loadAnnualTaxData,
  type AnnualTaxData,
} from '../../reports/helpers/annual-tax-data.helper.js';
import { Report1214ProfileProvider } from '../providers/report-1214-profile.provider.js';
import { ShareholdersProvider } from '../providers/shareholders.provider.js';
import type {
  Report1214AmountProto,
  Report1214BuildResult,
  Report1214IssueProto,
  Report1214ProfileProto,
  ShareholderProto,
} from '../types.js';
import { isActiveReport1214Owner } from './owner.helper.js';
import {
  CODE_SOURCES,
  codeSourcesNeedTaxData,
  computeMainFormAmounts,
  REPORT_1214_AMOUNT_RULES,
} from './report-1214-amounts.helper.js';
import {
  amountOverrideCodes,
  bankAccountToGql,
  mapReport1214ProfileRow,
  REPORT_1214_PHONE_PREFIXES,
} from './report-1214-profile.helper.js';
import { mapShareholderRow } from './shareholders.helper.js';

/** `true` when type `T` is `never`; used for compile-time drift checks against the generator. */
type AssertNever<T extends never> = T;

/**
 * Rule IDs of the issues raised while building the generator input (before `validate1214` runs).
 * They share the generator's issue shape; the `accounter.` prefix tells them apart.
 */
export const REPORT_1214_MAPPING_RULES = {
  /** error: the generator has no layout for the tax year; no input is built. */
  taxYearUnsupported: 'accounter.taxYear.unsupported',
  /** error: the business has no company (tax file) number. */
  fileNumberMissing: 'accounter.company.fileNumber.missing',
  /** error: neither the profile nor the business supplies an address (mailing / business). */
  addressMissing: 'accounter.company.address.missing',
  /** error: neither the profile nor the business supplies a phone number. */
  phoneMissing: 'accounter.company.phone.missing',
  /** error: the business phone number is not an Israeli number form 1214 accepts. */
  phoneUnparsable: 'accounter.company.phone.unparsable',
  /** error: a required yes/no declaration is unanswered. */
  declarationMissing: 'accounter.declarations.missing',
  /** warning: a stored amount override of a code the report derives was left out. */
  derivedOverrideDropped: 'accounter.amounts.derivedOverrideDropped',
  ...REPORT_1214_AMOUNT_RULES,
} as const;

/**
 * The required members of `Declarations`, all yes/no. The check below makes TypeScript fail if
 * the generator adds or drops a required member.
 */
const REQUIRED_DECLARATION_KEYS = [
  'hasTaxPlanningAction',
  'hadRelatedPartyTransactions',
  'controlsBodyOfPersons',
  'holdsRightsInBodyOfPersons',
  'appliesAccountingStandards',
  'directorsReceivedOpinion',
  'tookReportablePosition',
] as const satisfies ReadonlyArray<keyof Declarations>;
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];
export type _RequiredDeclarationsCovered = AssertNever<
  Exclude<RequiredKeys<Declarations>, (typeof REQUIRED_DECLARATION_KEYS)[number]>
>;

/** Human labels of the required declarations, for the "answer …" messages. */
const REQUIRED_DECLARATION_LABELS: Record<(typeof REQUIRED_DECLARATION_KEYS)[number], string> = {
  hasTaxPlanningAction: 'whether the company took a tax-planning action (878)',
  hadRelatedPartyTransactions: 'whether the company had related-party transactions (879)',
  controlsBodyOfPersons: 'whether the company controls a body of persons (880)',
  holdsRightsInBodyOfPersons: 'whether the company holds rights in a body of persons (881)',
  appliesAccountingStandards: 'whether the company applies accounting standards (882)',
  directorsReceivedOpinion: 'whether the directors received an opinion (1029)',
  tookReportablePosition: 'whether the company took a reportable position (1030)',
};

const PHONE_PREFIX_SET: ReadonlySet<string> = new Set(REPORT_1214_PHONE_PREFIXES);

/**
 * Parses an Israeli phone number as people type it into the `{ prefix, number }` form 1214 wants.
 * Accepts `+972` / `972` / `00972` country codes (with or without the trunk 0 after them), spaces,
 * dashes, dots and parentheses. The prefix must be one form 1214 allows (2 digits for landlines,
 * 3 for mobile and 07x numbers), followed by exactly 7 digits. Anything else (extensions, foreign
 * numbers, other prefixes) is `null`.
 */
export function parseIsraeliPhone(raw: string | null | undefined): Phone | null {
  const trimmed = raw?.trim();
  if (!trimmed || !/^\+?[\d\s\-.()]+$/.test(trimmed)) {
    return null;
  }
  let digits = trimmed.replace(/\D/g, '');
  const international = /^(?:00)?972/.exec(digits);
  if (international) {
    digits = digits.slice(international[0].length);
    if (!digits.startsWith('0')) {
      digits = `0${digits}`;
    }
  } else if (trimmed.startsWith('+')) {
    return null; // another country code
  }
  if (!digits.startsWith('0')) {
    return null;
  }
  for (const prefixLength of [3, 2]) {
    const prefix = digits.slice(0, prefixLength);
    const number = digits.slice(prefixLength);
    if (PHONE_PREFIX_SET.has(prefix) && /^\d{7}$/.test(number)) {
      return { prefix: prefix as PhonePrefix, number };
    }
  }
  return null;
}

/** `"<street>, <city> <zip>"`, leaving out the empty parts; `undefined` when nothing is set. */
export function composeAddress(
  street: string | null | undefined,
  city: string | null | undefined,
  zipCode: string | null | undefined,
): string | undefined {
  const locality = [city, zipCode]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ');
  const address = [street?.trim(), locality].filter(Boolean).join(', ');
  return address || undefined;
}

/** Trimmed text, or `undefined` when empty. */
function text(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

/** `undefined` for an empty object, the object otherwise. */
function nonEmpty<T extends object>(value: T): T | undefined {
  return Object.keys(value).length === 0 ? undefined : value;
}

/** `undefined` for an empty list, the list otherwise. */
function nonEmptyList<T>(value: T[]): T[] | undefined {
  return value.length === 0 ? undefined : value;
}

/** Drops the `undefined` members, so the input carries only what is set. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, member]) => member !== undefined),
  ) as T;
}

function mappingIssue(
  ruleId: string,
  severity: Report1214IssueProto['severity'],
  path: string,
  message: string,
  code?: string,
): Report1214IssueProto {
  return compact({ ruleId, severity, path, message, code });
}

/** A stored shareholder → the generator's `Shareholder` (unset members left out). */
export function shareholderToInput(shareholder: ShareholderProto): Shareholder {
  return compact({
    idNumber: shareholder.idNumber,
    fullName: shareholder.fullName,
    isControllingShareholder: shareholder.isControllingShareholder,
    dividendRightsPercent: shareholder.dividendRightsPercent ?? undefined,
    votingRightsPercent: shareholder.votingRightsPercent ?? undefined,
    otherRightsPercent: shareholder.otherRightsPercent ?? undefined,
    isMaterialShareholder: shareholder.isMaterialShareholder ?? undefined,
    salaryMonths1To9: shareholder.salaryMonths1To9 ?? undefined,
    salaryMonths10To12: shareholder.salaryMonths10To12 ?? undefined,
    otherPayments: shareholder.otherPayments ?? undefined,
  });
}

/** The business columns the report takes the company identity from. */
export type Report1214BusinessIdentity = Pick<
  IGetBusinessesByIdsResult,
  | 'name'
  | 'hebrew_name'
  | 'vat_number'
  | 'address'
  | 'address_hebrew'
  | 'city'
  | 'zip_code'
  | 'email'
  | 'phone_number'
>;

/** The admin-business columns the report takes the withholding file from. */
export type Report1214AdminBusinessIdentity = Pick<
  IGetAdminBusinessesByIdsResult,
  'company_tax_id'
>;

export interface AssembleReport1214InputParams {
  year: number;
  business: Report1214BusinessIdentity | null;
  adminBusiness: Report1214AdminBusinessIdentity | null;
  profile: Report1214ProfileProto;
  shareholders: ReadonlyArray<ShareholderProto>;
  /**
   * The books of the year for the computed amounts (`resolveReport1214TaxData`), with the issues
   * raised while loading them. Absent: only the amounts that need no books are computed.
   */
  taxData?: Report1214TaxDataResult;
}

/**
 * Builds the company identity: the books first, profile overrides win. Missing required members
 * are reported as mapping issues and left out (the generator then reports `input.shape` as well).
 */
function assembleCompany(
  business: Report1214BusinessIdentity | null,
  adminBusiness: Report1214AdminBusinessIdentity | null,
  overrides: Report1214ProfileProto['company'],
  issues: Report1214IssueProto[],
): CompanyDetails {
  const fileNumber = text(business?.vat_number);
  if (!fileNumber) {
    issues.push(
      mappingIssue(
        REPORT_1214_MAPPING_RULES.fileNumberMissing,
        'error',
        'company.fileNumber',
        'The business has no company number: set it (government ID / VAT number) on the business',
      ),
    );
  }

  const booksAddress = business
    ? composeAddress(business.address_hebrew || business.address, business.city, business.zip_code)
    : undefined;
  const mailingAddress = overrides.mailingAddress ?? booksAddress;
  const businessAddress = overrides.businessAddress ?? booksAddress;
  for (const [member, value] of [
    ['mailingAddress', mailingAddress],
    ['businessAddress', businessAddress],
  ] as const) {
    if (!value) {
      issues.push(
        mappingIssue(
          REPORT_1214_MAPPING_RULES.addressMissing,
          'error',
          `company.${member}`,
          `No ${member === 'mailingAddress' ? 'mailing' : 'business'} address: set the business address, or set it in the 1214 profile`,
        ),
      );
    }
  }

  let phone = overrides.phone;
  if (!phone) {
    const rawPhone = text(business?.phone_number);
    phone = parseIsraeliPhone(rawPhone) ?? undefined;
    if (!phone) {
      issues.push(
        rawPhone
          ? mappingIssue(
              REPORT_1214_MAPPING_RULES.phoneUnparsable,
              'error',
              'company.phone',
              `The business phone number "${rawPhone}" is not an Israeli number form 1214 accepts: set the company phone in the 1214 profile`,
            )
          : mappingIssue(
              REPORT_1214_MAPPING_RULES.phoneMissing,
              'error',
              'company.phone',
              'The business has no phone number: set the company phone in the 1214 profile',
            ),
      );
    }
  }

  return compact({
    fileNumber: fileNumber!,
    registeredName:
      overrides.registeredName ?? text(business?.hebrew_name) ?? text(business?.name) ?? '',
    withholdingFileNumber: overrides.withholdingFileNumber ?? text(adminBusiness?.company_tax_id),
    vatFileNumber: text(business?.vat_number),
    occupationDescription: overrides.occupationDescription,
    mailingAddress: mailingAddress!,
    businessAddress: businessAddress!,
    booksAddress: overrides.booksAddress,
    email: overrides.email ?? text(business?.email),
    phone: phone!,
    fax: overrides.fax,
  });
}

/**
 * The stored declarations with every required member answered. Each unanswered one is a mapping
 * error; it is filled with `false` only so the rest of the input can still be validated (the
 * error blocks the file).
 */
function assembleDeclarations(
  stored: Report1214ProfileProto['declarations'],
  issues: Report1214IssueProto[],
): Declarations {
  const filled: Partial<Declarations> = { ...stored };
  for (const key of REQUIRED_DECLARATION_KEYS) {
    if (typeof stored[key] !== 'boolean') {
      issues.push(
        mappingIssue(
          REPORT_1214_MAPPING_RULES.declarationMissing,
          'error',
          `declarations.${key}`,
          `Answer ${REQUIRED_DECLARATION_LABELS[key]} in the 1214 profile`,
        ),
      );
      filled[key] = false;
    }
  }
  return filled as Declarations;
}

/**
 * The record 1000 amounts: the computed ones (`computeMainFormAmounts`) under the profile's
 * overrides. An override wins by its presence, so an override of 0 replaces (or, for a code that
 * does not allow 0, suppresses) the computed amount. Overrides of codes the year's layout derives
 * are left out, each with a warning.
 */
function assembleAmounts(
  year: number,
  computedAmounts: Readonly<Record<string, number>>,
  storedOverrides: Report1214ProfileProto['amountOverrides'],
  issues: Report1214IssueProto[],
): { amounts: Report1214Input['amounts']; rows: Report1214AmountProto[] } {
  const { derivedCodes } = amountOverrideCodes(year);
  const overrides: Record<string, number> = {};
  for (const [code, amount] of Object.entries(storedOverrides)) {
    if (typeof amount !== 'number') {
      continue;
    }
    if (derivedCodes.has(code)) {
      issues.push(
        mappingIssue(
          REPORT_1214_MAPPING_RULES.derivedOverrideDropped,
          'warning',
          `amounts["${code}"]`,
          `The stored amount of code ${code} was left out: the ${year} report derives this code from other data. Remove the override from the 1214 profile`,
          code,
        ),
      );
      continue;
    }
    overrides[code] = amount;
  }

  const amounts: Record<string, number> = { ...computedAmounts, ...overrides };
  const rows = Object.keys(amounts)
    .sort()
    .map((code): Report1214AmountProto => ({
      code,
      amount: amounts[code],
      source: Object.hasOwn(overrides, code) ? 'OVERRIDE' : 'COMPUTED',
      computedAmount: Object.hasOwn(computedAmounts, code) ? computedAmounts[code] : null,
      label: CODE_SOURCES[code as keyof typeof CODE_SOURCES]?.label ?? null,
    }));
  return { amounts: amounts as Report1214Input['amounts'], rows };
}

/**
 * Pure part of `buildReport1214Input`: the generator input for a tax year, from the business
 * identity, the 1214 profile, the shareholders and the books. Amounts are the computed ones
 * (`computeMainFormAmounts`) under the profile's overrides (`assembleAmounts`).
 *
 * Never invents data: what is missing is reported as a mapping issue (rule IDs in
 * `REPORT_1214_MAPPING_RULES`) and left out, so `validate1214` reports the rest. The only filler
 * is `false` for unanswered required declarations, each already an error that blocks the file.
 * A tax year without a generator layout yields `input: null`.
 */
export function assembleReport1214Input({
  year,
  business,
  adminBusiness,
  profile,
  shareholders,
  taxData,
}: AssembleReport1214InputParams): Report1214BuildResult {
  if (!supportedTaxYears().includes(year)) {
    return {
      input: null,
      mappingIssues: [
        mappingIssue(
          REPORT_1214_MAPPING_RULES.taxYearUnsupported,
          'error',
          'taxYear',
          `Form 1214 cannot be generated for ${year}: supported tax years are ${supportedTaxYears().join(', ')}`,
        ),
      ],
      amounts: [],
    };
  }

  const mappingIssues: Report1214IssueProto[] = [...(taxData?.issues ?? [])];
  const company = assembleCompany(business, adminBusiness, profile.company, mappingIssues);
  const declarations = assembleDeclarations(profile.declarations, mappingIssues);
  const computed = computeMainFormAmounts({ year, tax: taxData?.tax ?? null, profile });
  mappingIssues.push(...computed.issues);
  const { amounts, rows } = assembleAmounts(
    year,
    computed.amounts,
    profile.amountOverrides,
    mappingIssues,
  );

  const bankAccount = bankAccountToGql(profile.bankAccount) ?? undefined;
  const input: Report1214Input = compact({
    taxYear: year as SupportedTaxYear,
    company,
    preparer: nonEmpty(profile.preparer),
    declarations,
    otherTaxableIncome: nonEmpty(profile.otherTaxableIncome),
    attachments: nonEmpty(profile.attachments),
    capitalGainsSummary: nonEmpty(profile.capitalGainsSummary),
    qualifyingCompany: nonEmpty(profile.qualifyingCompany),
    bankAccount,
    amounts,
    relatedCompanies: nonEmptyList(profile.relatedCompanies),
    shareholders: shareholders.map(shareholderToInput),
    rdInvestments: nonEmptyList(profile.rdInvestments),
  });
  return { input, mappingIssues, amounts: rows };
}

/** The books of a tax year for the computed amounts, or `null` with the reason as an issue. */
export interface Report1214TaxDataResult {
  tax: AnnualTaxData | null;
  issues: Report1214IssueProto[];
}

export interface ResolveReport1214TaxDataParams {
  year: number;
  ownerId: string;
  /** Whether `ownerId` is the session's active business (see `isActiveReport1214Owner`). */
  isActiveOwner: () => Promise<boolean>;
  /** Loads the books (`loadAnnualTaxData`). */
  load: () => Promise<AnnualTaxData>;
}

/**
 * Loads the books of a tax year for the computed amounts, when it is safe and useful:
 *
 * - Nothing is loaded (and nothing reported) when no code of the year needs the books.
 * - The year must have a generator layout, and the owner must be the session's active business:
 *   the tax computation reads the session's settings, so another owner's books would be mixed
 *   with them. Otherwise a `computationSkipped` warning says why.
 * - A failing load or tax computation (e.g. no corporate tax rate for the year) is a
 *   `computationFailed` warning; the report goes on with the overrides only.
 */
export async function resolveReport1214TaxData({
  year,
  ownerId,
  isActiveOwner,
  load,
}: ResolveReport1214TaxDataParams): Promise<Report1214TaxDataResult> {
  if (!supportedTaxYears().includes(year) || !codeSourcesNeedTaxData(year)) {
    return { tax: null, issues: [] };
  }
  if (!(await isActiveOwner())) {
    return {
      tax: null,
      issues: [
        mappingIssue(
          REPORT_1214_MAPPING_RULES.computationSkipped,
          'warning',
          'amounts',
          `Amounts were not computed from the books: business ${ownerId} is not the active business. Switch to it to compute them, or set them in the 1214 profile`,
        ),
      ],
    };
  }
  try {
    return { tax: await load(), issues: [] };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      tax: null,
      issues: [
        mappingIssue(
          REPORT_1214_MAPPING_RULES.computationFailed,
          'warning',
          'amounts',
          `Amounts could not be computed from the books of ${year} (${reason}): set them in the 1214 profile`,
        ),
      ],
    };
  }
}

/**
 * Builds the form 1214 generator input of an owner and tax year from the books (business and
 * admin-business identity), the stored 1214 profile and the shareholders. See
 * `assembleReport1214Input` for the mapping rules.
 */
export async function buildReport1214Input(
  injector: Injector,
  ownerId: string,
  year: number,
): Promise<Report1214BuildResult> {
  const [business, adminBusiness, profileRow, shareholderRows, taxData] = await Promise.all([
    injector.get(BusinessesProvider).getBusinessByIdLoader.load(ownerId),
    injector.get(AdminBusinessesProvider).getAdminBusinessByIdLoader.load(ownerId),
    injector.get(Report1214ProfileProvider).getProfileByOwnerAndYearLoader.load({ ownerId, year }),
    injector.get(ShareholdersProvider).getShareholdersByOwnerAndYearLoader.load({ ownerId, year }),
    resolveReport1214TaxData({
      year,
      ownerId,
      isActiveOwner: () => isActiveReport1214Owner(injector, ownerId),
      load: () => loadAnnualTaxData(injector, ownerId, year),
    }),
  ]);
  return assembleReport1214Input({
    year,
    business: business ?? null,
    adminBusiness: adminBusiness ?? null,
    profile: mapReport1214ProfileRow(profileRow, ownerId, year),
    shareholders: shareholderRows.map(mapShareholderRow),
    taxData,
  });
}
