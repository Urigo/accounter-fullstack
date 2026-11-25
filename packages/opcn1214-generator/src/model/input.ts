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

/** Allowed phone prefixes (SPEC §4.2, §7.2). */
export type PhonePrefix =
  | '02'
  | '03'
  | '04'
  | '08'
  | '09'
  | '072'
  | '073'
  | '074'
  | '076'
  | '077'
  | '050'
  | '052'
  | '053'
  | '054'
  | '055'
  | '057'
  | '058'
  | '059';

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
    /**
     * 1000@150, ≤ 15 characters, default 'ACCOUNTER'; a value that is empty after text
     * normalization (SPEC §4.3) also gets the default.
     */
    softwareName?: string;
    /** 1000@165, default `options.today()` (SPEC §7.4). */
    saveDate?: IsoDate;
  };
  company: CompanyDetails;
  declarations: Declarations;
  /** Record 1000 code-amount section. */
  amounts: Partial<Record<MainFormInputCode, number>>;
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

/** Declarations of record 1000 (SPEC §7.2): the required yes/no members. */
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
}

/** One shareholder, record 1020 (SPEC §7.2). */
export interface Shareholder {
  /** 1020@139: 9 digits, or 999999964 / 999999998. */
  idNumber: string;
  /** 1020@148, ≤ 50; must start with a Hebrew letter. */
  fullName: string;
  /** 1020@198 (yes/no). */
  isControllingShareholder: boolean;
  /** 1020@199, percent with up to 2 decimals (`12.5` is 12.5%); all shareholders must total 100. */
  dividendRightsPercent?: number;
  /** 1020@204, percent with up to 2 decimals. */
  votingRightsPercent?: number;
  /** 1020@209, percent with up to 2 decimals. */
  otherRightsPercent?: number;
  /** 1020@214 (flag). */
  isMaterialShareholder?: boolean;
  /** 1020@215, whole shekels. */
  salaryMonths1To9?: number;
  /** 1020@227, whole shekels. */
  salaryMonths10To12?: number;
  /** 1020@239, whole shekels. */
  otherPayments?: number;
}
