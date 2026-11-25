import type {
  CompanyDetails,
  Declarations,
  MainFormInputCode,
  PreparerDetails,
  RdInvestment,
  RelatedCompany,
  Report1214Input,
} from '@accounter/opcn1214-generator';

export type * from './__generated__/types.js';
export type * from './__generated__/shareholders.types.js';
export type {
  IGetReport1214ProfilesByOwnerAndYearsQuery,
  IGetReport1214ProfilesByOwnerAndYearsResult,
  IUpsertReport1214ProfileQuery,
} from './__generated__/report-1214-profile.types.js';

/** GraphQL `Shareholder` parent: a `shareholders` row with numeric columns as numbers. */
export interface ShareholderProto {
  id: string;
  ownerId: string;
  year: number;
  businessId: string | null;
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  dividendRightsPercent: number | null;
  votingRightsPercent: number | null;
  otherRightsPercent: number | null;
  isMaterialShareholder: boolean | null;
  salaryMonths1To9: number | null;
  salaryMonths10To12: number | null;
  otherPayments: number | null;
  sortOrder: number;
}

/**
 * The JSONB blocks of a `report_1214_profiles` row. Each one is stored in the shape of the matching
 * `@accounter/opcn1214-generator` input type (camelCase, unset members left out), so building the
 * generator input is mostly a pass-through.
 */

/** `company`: overrides and extras for `CompanyDetails`; `fileNumber` always comes from the books. */
export type Report1214CompanyOverridesData = Partial<
  Pick<
    CompanyDetails,
    | 'registeredName'
    | 'phone'
    | 'fax'
    | 'email'
    | 'occupationDescription'
    | 'mailingAddress'
    | 'businessAddress'
    | 'booksAddress'
    | 'withholdingFileNumber'
  >
>;
/** `declarations`: possibly partial, the report validation names missing required members. */
export type Report1214DeclarationsData = Partial<Declarations>;
export type Report1214PreparerData = PreparerDetails;
export type Report1214AttachmentsData = NonNullable<Report1214Input['attachments']>;
export type Report1214BankAccountData = NonNullable<Report1214Input['bankAccount']>;
export type Report1214OtherTaxableIncomeData = NonNullable<Report1214Input['otherTaxableIncome']>;
export type Report1214CapitalGainsSummaryData = NonNullable<Report1214Input['capitalGainsSummary']>;
export type Report1214QualifyingCompanyData = NonNullable<Report1214Input['qualifyingCompany']>;
export type Report1214RelatedCompanyData = RelatedCompany;
export type Report1214RdInvestmentData = RdInvestment;
/** `amount_overrides`: record 1000 input code → amount. */
export type Report1214AmountOverridesData = Partial<Record<MainFormInputCode, number>>;

/**
 * GraphQL `Report1214Profile` parent: the stored profile of an owner and year (empty blocks when
 * no row exists). `{}` means "not set" for every object block.
 */
export interface Report1214ProfileProto {
  ownerId: string;
  year: number;
  company: Report1214CompanyOverridesData;
  declarations: Report1214DeclarationsData;
  preparer: Report1214PreparerData;
  attachments: Report1214AttachmentsData;
  /** `{}` when no changed bank account is stored. */
  bankAccount: Partial<Report1214BankAccountData>;
  otherTaxableIncome: Report1214OtherTaxableIncomeData;
  capitalGainsSummary: Report1214CapitalGainsSummaryData;
  qualifyingCompany: Report1214QualifyingCompanyData;
  relatedCompanies: Report1214RelatedCompanyData[];
  rdInvestments: Report1214RdInvestmentData[];
  amountOverrides: Report1214AmountOverridesData;
  /** `null` when no row is stored yet. */
  updatedAt: Date | null;
}

/**
 * A finding about a form 1214 report: a generator `Issue` (`validate1214` / `generate1214`), or a
 * mapping issue raised while building the generator input from the books and the profile (rule ID
 * prefixed `accounter.`, no spec reference).
 */
export interface Report1214IssueProto {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  /** Input path (generator path grammar); `''` for report-level issues. */
  path: string;
  code?: string;
  recordType?: string;
  specRef?: { page: number; note?: string };
}

/** GraphQL `Report1214Amount` parent: one record 1000 amount of the built input. */
export interface Report1214AmountProto {
  code: string;
  /** The amount in the input: the override when there is one, the computed amount otherwise. */
  amount: number;
  source: 'COMPUTED' | 'OVERRIDE';
  /** The amount Accounter computed for the code, also when an override replaces it. */
  computedAmount: number | null;
  /** The code's Hebrew name, for the codes Accounter computes. */
  label: string | null;
}

/** The generator input built for an owner and year, with the issues found while building it. */
export interface Report1214BuildResult {
  /** `null` when no input can be built at all (a tax year the generator has no layout for). */
  input: Report1214Input | null;
  mappingIssues: Report1214IssueProto[];
  /** The record 1000 amounts of `input`, sorted by code (empty when there is no input). */
  amounts: Report1214AmountProto[];
}

/**
 * GraphQL `Report1214` parent. `build` runs the input build once per query and is shared by the
 * `validation` and `file` fields; it starts on first use.
 */
export interface Report1214Proto {
  ownerId: string;
  year: number;
  build: () => Promise<Report1214BuildResult>;
}
