/**
 * Public input model (SPEC §7). Conventions (SPEC §7.1): money in ILS, dates as ISO `YYYY-MM-DD`
 * strings, identification numbers as digit strings, booleans for flags and yes/no fields, code maps
 * keyed by the 3-digit code string.
 */
import type { MainFormInputCode } from './codes.generated.js';

/** An ISO calendar date, `YYYY-MM-DD` (SPEC §7.2). */
export type IsoDate = string;

/** Tax years with a layout (SPEC §7.2, §14). */
export type SupportedTaxYear = 2024 | 2025;

/** Allowed phone prefixes (SPEC §4.2, p.6–7). */
export const PHONE_PREFIXES = [
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
] as const;

/** Allowed phone prefixes (SPEC §4.2, §7.2). */
export type PhonePrefix = (typeof PHONE_PREFIXES)[number];

/** A phone or fax number (SPEC §7.2). */
export interface Phone {
  prefix: PhonePrefix;
  /** Exactly 7 digits. */
  number: string;
}

/** One OPCN 1214 report (SPEC §7.2). */
export interface Report1214Input {
  /** 1000@146; selects the layout. */
  taxYear: SupportedTaxYear;
  meta?: {
    /** 1000@150, ≤ 15 characters, default 'ACCOUNTER'. */
    softwareName?: string;
    /** 1000@165, default `options.today()` (SPEC §7.4). */
    saveDate?: IsoDate;
  };
  company: CompanyDetails;
  /** "המסייע/ת במילוי הדו"ח", 1000@563–831. */
  preparer?: PreparerDetails;
  declarations: Declarations;
  /** "הכנסה חייבת אחרת בארץ ובחו"ל", 1000@887–953. */
  otherTaxableIncome?: {
    /** 887; must start with a Hebrew letter. */
    source?: string;
    /** 937. */
    amount?: number;
    /** 949: 1–100, ≤ 2 decimals (written × 100, SPEC §15 A-2). */
    ratePercent?: number;
  };
  /** Numbers of certificates attached to the report, 1000@954–959. */
  attachments?: {
    /** 954: donation receipts for code 070 (section 46). */
    donationReceiptsCount?: number;
    /** 957: withholding certificates for code 010. */
    withholdingCertificatesCount?: number;
  };
  /** Capital-gains appendices, transmitted and not, 1000@960–1017. */
  capitalGainsSummary?: {
    /** 960: all appendices, transmitted and not. */
    totalAppendicesCount?: number;
    /** 962 (→ 833 = yes when > 0, SPEC §7.4). */
    untransmittedCount?: number;
    /** 964–968: why appendices were not transmitted. */
    reasons?: {
      /** 964. */
      lossOrNoGain?: boolean;
      /** 965. */
      overFiveImprovementBalances?: boolean;
      /** 966. */
      over14Appendices?: boolean;
      /** 967. */
      other?: boolean;
      /** 968: required when `other`. */
      otherText?: string;
    };
  };
  /** "חברה מזכה" (part A of the form), 1000@1065–1102. */
  qualifyingCompany?: {
    /** 1065 (yes/no). */
    purchased?: boolean;
    /** 1066. */
    israeliPurchaseAmount?: number;
    /** 1078. */
    foreignPurchaseAmount?: number;
    /** 1090 (yes/no). */
    amortizationClaimed?: boolean;
    /** 1091: may be 0, which is written (SPEC §15 A-21). */
    amortizationAmount?: number;
  };
  /** → codes 277/278/280 = 1 (SPEC §7.4); only when changing the account on file. */
  bankAccount?: {
    /** Exactly 2 digits. */
    bank: string;
    /** Exactly 3 digits. */
    branch: string;
    /** 1–9 digits. */
    account: string;
  };
  /** Record 1000 code-amount section; derived codes (SPEC §7.4) are not accepted. */
  amounts: Partial<Record<MainFormInputCode, number>>;
  /** Records 1010: at most 3 (struct.relatedCompanies.max). */
  relatedCompanies?: RelatedCompany[];
  /** Records 1020: 1–99 (0 allowed only for a kibbutz). */
  shareholders: Shareholder[];
}

/** Company identity (SPEC §7.2), record 1000@137–512. */
export interface CompanyDetails {
  /** 1000@137 "מספר תיק". */
  fileNumber: string;
  /** 1000@175, ≤ 50 (SHAAM replaces it with the registry name if different). */
  registeredName: string;
  /** 1000@225 "תיק ניכויים". */
  withholdingFileNumber?: string;
  /** 1000@234. */
  vatFileNumber?: string;
  /** 1000@243. */
  occupationDescription?: string;
  /** 1000@293. */
  mailingAddress: string;
  /** 1000@343. */
  businessAddress: string;
  /** 1000@393, where the books are kept. */
  booksAddress?: string;
  /** 1000@443. */
  email?: string;
  /** 1000@493/496. */
  phone: Phone;
  /** 1000@503/506. */
  fax?: Phone;
}

/** The person or office that helped fill in the report (SPEC §7.2), 1000@563–831. */
export interface PreparerDetails {
  /** 1000@563. */
  officeName?: string;
  /** 1000@613. */
  contactName?: string;
  /** 1000@663. */
  name?: string;
  /** 1000@713. */
  profession?: string;
  /** 1000@763 "מספר עוסק מורשה (מסייע)". */
  licensedDealerNumber?: string;
  /** 1000@772. */
  address?: string;
  /** 1000@822/825. */
  phone?: Phone;
}

/** Declarations of record 1000 (SPEC §7.2). */
export interface Declarations {
  /** 878. */
  hasTaxPlanningAction: boolean;
  /** 879. */
  hadRelatedPartyTransactions: boolean;
  /** 880. */
  controlsBodyOfPersons: boolean;
  /** 881. */
  holdsRightsInBodyOfPersons: boolean;
  /** 882 (→ code 008 = 1). */
  appliesAccountingStandards: boolean;
  /** 1029 (→ code 273). */
  directorsReceivedOpinion: boolean;
  /** 1030 (→ code 273). */
  tookReportablePosition: boolean;
  /** 1034–1046: up to 5 position numbers (form 1346), 1–999. */
  reportablePositions?: number[];
  /** 834 (→ code 297 = 8 / 9). */
  form6111Obligation?: 'obliged' | 'notObliged' | 'notRelevant';
  /** 835. */
  financialStatementsAttached?: boolean;
  /** 836 + 837 (+ code 080 required). */
  familyCompany?: { representativeFileNumber: string };
  /** 846 (+ code 084 required). */
  isHouseCompany?: boolean;
  /** 847. */
  form1343Attached?: boolean;
  /** 848. */
  form1344Attached?: boolean;
  /** 849 (required when code 101 or 102 is filled). */
  claimsCapitalInvestmentLawBenefits?: boolean;
  /** 850. */
  preferredEnterprise?: boolean;
  /** 851 + 852. */
  beneficiaryEnterprise?: { noticeDate: IsoDate };
  /** 862. */
  dividendDistributed?: boolean;
  /** 863 + 864. */
  specialYear?: { balanceSheetDate: IsoDate };
  /** 874. */
  foreignInvestors?: boolean;
  /** 875 → 1/2/3. */
  consolidatedReport?: 'consolidatedUnderSection23' | 'consolidatesWithParent' | 'notRelevant';
  /** 876. */
  partnerInPartnership?: boolean;
  /** 877. */
  isKibbutz?: boolean;
  /** 883 (yes/no). */
  requestsAdvancePayments?: boolean;
  /** 884 (yes/no; → code 259 required). */
  hasBuildingIncome?: boolean;
  /** 886. */
  isTrustBeneficiary?: boolean;
  /** 1031. */
  nonDeductibleSalaryExpenses?: boolean;
  /** 1032. */
  fewMembersCompany62A?: boolean;
  /** 1033 (yes/no). */
  partOfMultinationalGroup?: boolean;
  /** 1064. */
  noBankAccount?: boolean;
  /** 833: forces "yes" when capital-gains appendices exist but none are transmitted (otherwise
   *  derived from the appendices and `capitalGainsSummary.untransmittedCount`, SPEC §7.4). */
  hasCapitalGainsAppendix?: boolean;
}

/** A related company in Israel or abroad, record 1010 (SPEC §7.2). */
export interface RelatedCompany {
  /** 1010@139, ≤ 50. */
  companyName: string;
  /** 1010@189 "מספר תיק חברה". */
  companyFileNumber?: string;
  /** 1010@198 → 1..8 in this order. */
  relationType:
    | 'parent'
    | 'subsidiary'
    | 'partnership'
    | 'kibbutzRelatedCorporation'
    | 'jointlyControlled'
    | 'granddaughter'
    | 'grandmother'
    | 'other';
  /** 1010@199: the assessing office of the company's file, 2 digits. */
  assessingOfficeCode?: number;
}

/** One shareholder, record 1020 (SPEC §7.2). */
export interface Shareholder {
  /** 9 digits, or 999999964 / 999999998. */
  idNumber: string;
  /** Must start with a Hebrew letter. */
  fullName: string;
  isControllingShareholder: boolean;
  /** All shareholders must total 100. */
  dividendRightsPercent?: number;
  votingRightsPercent?: number;
  otherRightsPercent?: number;
  isMaterialShareholder?: boolean;
  salaryMonths1To9?: number;
  salaryMonths10To12?: number;
  otherPayments?: number;
}
