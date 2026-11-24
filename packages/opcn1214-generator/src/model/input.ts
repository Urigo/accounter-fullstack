/**
 * Public input model (SPEC §7). Conventions (SPEC §7.1): money in ILS, dates as ISO `YYYY-MM-DD`
 * strings, identification numbers as digit strings, booleans for flags and yes/no fields, code maps
 * keyed by the 3-digit code string.
 */
import type {
  CapitalGainsCode,
  CountryBreakdownCode,
  CountryCode,
  ForeignAppendixCode,
  MainFormInputCode,
} from './codes.generated.js';

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
    /**
     * 1000@150, ≤ 15 characters, default 'ACCOUNTER'; a value that is empty after text
     * normalization (SPEC §4.3) also gets the default.
     */
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
    /**
     * 962 (→ 833 = yes when > 0, SPEC §7.4). Code 028 is `capitalGains.length` plus this count, at
     * most 99 (`field.length` here otherwise).
     */
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
    /**
     * 1090 (yes/no): amortization is claimed for the purchase, amount in 1091. p.12 gives 1090 the
     * same label as 1065 ("marking – purchase of a qualifying company"); this reading is inferred
     * from 1091 (SPEC §15 A-34).
     */
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
  /** Records 1030: at most 5 (struct.rdInvestments.max); their total is code 165. */
  rdInvestments?: RdInvestment[];
  /** Record 2000 (0–1); its presence derives 1000@832 and 9999@143 (SPEC §7.4). */
  foreignAppendix?: ForeignAppendix;
  /**
   * Records 30xx: at most 14 in total (struct.capitalGains.max); they derive 1000@833, code 028 and
   * 9999@145 (SPEC §7.4). Written grouped by record type, input order within a type (SPEC §3.3).
   */
  capitalGains?: CapitalGainsAppendix[];
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
  /** 1000@563, ≤ 50 characters. */
  officeName?: string;
  /** 1000@613, ≤ 50 characters. */
  contactName?: string;
  /** 1000@663, ≤ 50 characters. */
  name?: string;
  /** 1000@713, ≤ 50 characters. */
  profession?: string;
  /** 1000@763 "מספר עוסק מורשה (מסייע)": up to 9 digits, written zero-padded to 9. */
  licensedDealerNumber?: string;
  /** 1000@772, ≤ 50 characters. */
  address?: string;
  /** 1000@822/825. */
  phone?: Phone;
}

/**
 * Declarations of record 1000 (SPEC §7.2). The required members and those marked (yes/no) are
 * yes/no fields: `true` writes 1, `false` writes 2 and an absent optional one writes 0. The other
 * optional booleans, except `hasCapitalGainsAppendix`, are flags: `true` writes 1, while `false`
 * and absent both write 0 (a parsed file reads them back as absent).
 */
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
  /**
   * 836 + 837 (+ code 080 required). `representativeFileNumber`: up to 9 digits, written
   * zero-padded to 9.
   */
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
  /** 877 (+ code 226 required; the only case where `shareholders` may be empty). */
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
  /**
   * 1010@189 "מספר תיק חברה": 1–9 digits, zero-padded to 9 when written ('12' → '000000012'). It
   * must pass the Israeli check digit (`field.checkDigit`, SPEC §4.2).
   */
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

/** An investment in an R&D company, record 1030 (SPEC §7.2); affiliation 1030@137 is derived. */
export interface RdInvestment {
  /** 1030@138, ≤ 50. */
  companyName: string;
  /**
   * 1030@188 "מספר תיק חברה": 1–9 digits, zero-padded to 9 when written. It must pass the Israeli
   * check digit (`field.checkDigit`, SPEC §4.2).
   */
  companyFileNumber?: string;
  /** 1030@197, whole shekels. */
  investmentAmount: number;
}

/**
 * The foreign appendix "נספח חו"ל", record 2000 (SPEC §7.2). Header amounts are whole shekels;
 * an optional amount of 0 is written as absent.
 */
export interface ForeignAppendix {
  /** 2000@137, ≤ 50; required when `otherTaxableIncome` > 0 (foreign.otherIncome.description). */
  otherTaxableIncomeDescription?: string;
  /** 2000@187 "הכנסה חייבת אחרת". */
  otherTaxableIncome?: number;
  /** 2000@199, foreign tax paid on the other taxable income. */
  foreignTaxPaidOnOtherIncome?: number;
  /** 2000@211, total foreign taxable income. */
  totalForeignTaxableIncome?: number;
  /** 2000@223, total foreign loss. */
  totalForeignLoss?: number;
  /** 2000@235, participation exemption of an Israeli holding company. */
  participationExemptionHoldingCompany?: number;
  /** 2000@247 "הצהרה – החזר מסים" (required yes/no). */
  taxRefundDeclaration: boolean;
  /** 2000@248; expected when `taxRefundDeclaration` (foreign.refund.amount). */
  taxRefundDeclarationAmount?: number;
  /** Record 2000 code-amount section; a 0 is written only for the zeroAllowed code 442 (SPEC §4.5). */
  amounts: Partial<Record<ForeignAppendixCode, number>>;
  /**
   * Records 2200, one per per-country code written in `amounts` (SPEC §3.6): required for each such
   * code (foreign.breakdown.required) and allowed only for them (foreign.breakdown.orphan).
   */
  countryBreakdown?: Partial<Record<CountryBreakdownCode, CountryBreakdown>>;
}

/** The income of one foreign-appendix code by country, record 2200 (SPEC §3.6, §7.2). */
export interface CountryBreakdown {
  /** 2200@140, total deductions, offsets and exemptions of the code. */
  deductionsOffsetsAndExemptions?: number;
  /** The 2200 country-amount section: 1–10 countries, each at most once. */
  countries: CountryIncome[];
}

/** One entry of a country breakdown; its affiliation (always 1) is derived (SPEC §7.4). */
export interface CountryIncome {
  /**
   * A code of countries.csv, zero-padded to 3 digits when written (`'40'` → `'040'`); `'-88'`
   * (country unknown) only for code 439 (foreign.breakdown.country.unknownOnlyFor439).
   */
  country: CountryCode;
  /** Income before deductions, offsets and exemptions, whole shekels. */
  income: number;
}

/**
 * A capital-gains appendix, discriminated by its transaction symbol (record 30xx = 3000 + symbol,
 * SPEC §3.7). Its transaction symbol (30xx@137) and appendix number (30xx@139) are derived
 * (SPEC §7.4).
 */
export type CapitalGainsAppendix =
  | SecuritiesAppendix
  | Section6SecuritiesAppendix
  | ReitAppendix
  | NoWithholding1322Appendix
  | NoWithholding1326Appendix;

/**
 * A withholding agent of a securities appendix (records 3060, 3064, 3065): one of the four slots
 * "מנכה", "סניף", "חשבון" (3060/3064: 146–313, 3065: 147–314; SPEC §7.3). An empty slot is
 * written as absent.
 */
export interface Withholder {
  /** "מנכה", up to 30 characters; must start with a Hebrew letter (field.hebrewFirstLetter). */
  name?: string;
  /** "סניף", up to 3 digits, zero-padded when written ('12' → '012'). */
  branch?: string;
  /** "חשבון", up to 9 digits, zero-padded when written. */
  account?: string;
}

/** Capital gains from securities, record 3060 (SPEC §7.2, p.43–45). */
export interface SecuritiesAppendix {
  symbol: 60;
  /** 30xx@142 "נכס חו"ל" (yes/no). */
  foreignAsset?: boolean;
  /** 30xx@143 "מכירה לצד קשור" (yes/no). */
  soldToRelatedParty?: boolean;
  /** 30xx@144 "רכישה מצד קשור" (yes/no). */
  boughtFromRelatedParty?: boolean;
  /**
   * 30xx@145 "רווח מקרן השקעות" (yes/no). Only one value is allowed per appendix type (SPEC §15
   * A-8, cg.investmentFund.value): 3060 and 3065 `false`, 3064 `true`, or absent.
   */
  gainFromInvestmentFund?: boolean;
  /** 30xx@146–313: at most 4 withholding agents (input.shape), keyed `withholders[i].*`. */
  withholders?: Withholder[];
  /** 30xx@314, losses carried forward, whole shekels. */
  lossesCarriedForward?: number;
  /** Record 3060 code-amount section; no code of 3060 is zeroAllowed (SPEC §4.5). */
  amounts: Partial<Record<CapitalGainsCode<60>, number>>;
}

/** Capital gains from securities under section 6, record 3063 (SPEC §7.2). */
export interface Section6SecuritiesAppendix {
  symbol: 63;
  /** 3063@142 "נכס חו"ל" (yes/no). */
  foreignAsset?: boolean;
  /** 3063@143, losses carried forward, whole shekels. */
  lossesCarriedForward?: number;
  /** Record 3063 code-amount section; no code of 3063 is zeroAllowed (SPEC §4.5). */
  amounts: Partial<Record<CapitalGainsCode<63>, number>>;
}

/**
 * Capital gains from real-estate investment trust units, record 3064 (SPEC §7.2, p.48–49): the
 * header of record 3060 with its own codes.
 */
export interface ReitAppendix extends Omit<SecuritiesAppendix, 'symbol' | 'amounts'> {
  symbol: 64;
  /** Record 3064 code-amount section; no code of 3064 is zeroAllowed (SPEC §4.5). */
  amounts: Partial<Record<CapitalGainsCode<64>, number>>;
}

/**
 * "מס במקור" of records 3065 (146) and 3066 (143): tax was not withheld on gains accrued in the
 * first (January–June, → 2) or second (July–December, → 3) half of the tax year (SPEC §15 A-18);
 * absent → 0.
 */
export type WithholdingStatus = 'notWithheldFirstHalf' | 'notWithheldSecondHalf';

/**
 * Capital gains from securities without tax withholding, form 1322, record 3065 (SPEC §7.2,
 * p.50–52): the header of record 3060 with a withholding status; its "מספר בתל"ם" sequence
 * (3065@325) is derived (SPEC §7.4).
 */
export interface NoWithholding1322Appendix extends Omit<SecuritiesAppendix, 'symbol' | 'amounts'> {
  symbol: 65;
  /** 3065@146 "מס במקור": notWithheldFirstHalf → 2, notWithheldSecondHalf → 3, absent → 0. */
  withholdingStatus?: WithholdingStatus;
  /** Record 3065 code-amount section; no code of 3065 is zeroAllowed (SPEC §4.5). */
  amounts: Partial<Record<CapitalGainsCode<65>, number>>;
}

/**
 * Capital gains from securities without tax withholding, form 1326, record 3066 (SPEC §7.2,
 * p.53–54); its "מספר בתל"ם" sequence (3066@154) is derived (SPEC §7.4).
 */
export interface NoWithholding1326Appendix {
  symbol: 66;
  /** 3066@142 "נכס חו"ל" (yes/no). */
  foreignAsset?: boolean;
  /** 3066@143 "מס במקור": notWithheldFirstHalf → 2, notWithheldSecondHalf → 3, absent → 0. */
  withholdingStatus?: WithholdingStatus;
  /** 3066@144, losses carried forward, whole shekels. */
  lossesCarriedForward?: number;
  /** Record 3066 code-amount section; no code of 3066 is zeroAllowed (SPEC §4.5). */
  amounts: Partial<Record<CapitalGainsCode<66>, number>>;
}
