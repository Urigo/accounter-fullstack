/**
 * Tax Reporting System Interfaces
 * Based on specifications for Form 6111 electronic filing (טופס 6111)
 */

/**
 * Business type enum (סוג עסק)
 * @export
 * @enum {number}
 */
export enum BusinessType {
  /** Industrial (תעשייתי) */
  INDUSTRIAL = 1,
  /** Commercial (מסחרי) */
  COMMERCIAL = 2,
  /** Service providers (נותני שירותים) */
  SERVICE = 3,
  /** Report includes more than one business (הדוח כולל יותר מעסק אחד) */
  MULTIPLE = 4,
}

/**
 * Reporting method enum (שיטת דיווח)
 * @export
 * @enum {number}
 */
export enum ReportingMethod {
  /** Cash basis (מזומן) */
  CASH = 1,
  /** Accrual basis (מצטבר) */
  ACCRUAL = 2,
  /** According to dollar regulations (לפי תקנות דולריות) */
  DOLLAR_REGULATIONS = 9,
}

/**
 * Accounting method enum (שיטת חשבונאות)
 * @export
 * @enum {number}
 */
export enum AccountingMethod {
  /** Single-entry (חד צידית) */
  SINGLE_ENTRY = 1,
  /** Double-entry (כפולה) */
  DOUBLE_ENTRY = 2,
}

/**
 * Business accounting system enum (הנח"ש של העסק)
 * @export
 * @enum {number}
 */
export enum AccountingSystem {
  /** Manual (ידני) */
  MANUAL = 1,
  /** Computerized (ממוחשב) */
  COMPUTERIZED = 2,
}

/**
 * Yes/No enum for various boolean fields
 * @export
 * @enum {number}
 */
export enum YesNo {
  /** Yes (כן) */
  YES = 1,
  /** No (לא) */
  NO = 2,
}

/**
 * IFRS reporting option enum (דווח בחלופה - יישום תקני חשבונאות)
 * @export
 * @enum {number}
 */
export enum IfrsReportingOption {
  /** Option 1 (חלופה 1) */
  OPTION_1 = 1,
  /** Accounting adjustments for those who implemented Option 2 per directive 7/2010 (התאמות חשבונאיות למי שיישם את חלופה 2 בהוראת ביצוע 7/2010) */
  OPTION_2_ADJUSTMENTS = 2,
  /** Accounting adjustments for those who implemented Option 3 per directive 7/2010 (התאמות חשבונאיות למי שיישם את חלופה 3 בהוראת ביצוע 7/2010) */
  OPTION_3_ADJUSTMENTS = 3,
  /** No IFRS implementation (במידה ואין יישום תקני חשבונאות) */
  NONE = 9,
}

/**
 * Currency reporting type enum (דיווח מטבע)
 * @export
 * @enum {number}
 */
export enum CurrencyType {
  /** Amounts in shekels (הסכומים בשקלים) */
  SHEKELS = 1,
  /** Amounts in dollars (הסכומים בדולרים) */
  DOLLARS = 2,
}

/**
 * Audit opinion type enum (חוות דעת)
 * @export
 * @enum {number}
 */
export enum AuditOpinionType {
  /** Unqualified opinion (נוסח אחיד (בלתי מסוייג)) */
  UNQUALIFIED = 1,
  /** Unqualified opinion with emphasis on going concern (בנוסח אחיד עם הפניית תשומת לב להערת עסק חי) */
  UNQUALIFIED_WITH_GOING_CONCERN = 2,
  /** Unqualified opinion with other emphases (בנוסח אחיד עם הפניות תשומת לב אחרת) */
  UNQUALIFIED_WITH_OTHER_EMPHASES = 3,
  /** Qualified opinion (הסתייגות) */
  QUALIFIED = 4,
  /** Adverse opinion (שלילית) */
  ADVERSE = 5,
  /** Disclaimer of opinion (המנעות) */
  DISCLAIMER = 6,
  /** No audit opinion (אין חוות דעת) */
  NONE = 9,
}

/**
 * Report Data interface representing the complete tax report structure
 * @export
 * @interface ReportData
 */
export interface ReportData {
  /** Header record containing metadata about the tax report (כותרת) */
  header: HeaderRecord;
  /** Profit and Loss statement data entries (דו"ח רווח והפסד) */
  profitAndLoss: ReportEntry[];
  /** Tax adjustment statement data entries (דו"ח התאמה למס) */
  taxAdjustment: ReportEntry[];
  /** Balance sheet data entries (דו"ח מאזן) */
  balanceSheet: ReportEntry[];
}

/**
 * Header Record interface containing metadata about the tax report
 * @export
 * @interface HeaderRecord
 */
export interface HeaderRecord {
  /** Tax file number (9 digits) - mandatory field (מספר תיק) */
  taxFileNumber: string;
  /** Tax year (4 digits) - mandatory field (שנת מס) */
  taxYear: string;
  /** ID number or company registration number (9 digits) - mandatory field (מס' זהות/ח.פ) */
  idNumber: string;
  /** VAT file number (9 digits) - mandatory if exists (מס' תיק מע"מ) */
  vatFileNumber?: string;
  /** Withholding tax file number (9 digits) - mandatory if exists (מס' תיק ניכויים) */
  withholdingTaxFileNumber?: string;
  /** Industry code (4 digits) - mandatory field (מס' ענף) */
  industryCode: string;
  /** Business description (50 characters max) - right-aligned Hebrew text (תאור העסק) */
  businessDescription?: string;
  /** Business type - mandatory field (סוג עסק) */
  businessType: BusinessType;
  /** Reporting method - mandatory field (שיטת דיווח) */
  reportingMethod: ReportingMethod;
  /** Accounting method - mandatory field (שיטת חשבונאות) */
  accountingMethod: AccountingMethod;
  /** Business accounting system - mandatory field (הנח"ש של העסק) */
  accountingSystem: AccountingSystem;
  /** Is this report for a partnership (דוח זה בגין שותפות) */
  isPartnership?: YesNo;
  /** Profit and Loss statement included - mandatory field (מצורף דוח רווח הפסד) */
  includesProfitLoss: YesNo;
  /** Tax adjustment statement included - mandatory field (מצורף דוח התאמה) */
  includesTaxAdjustment: YesNo;
  /** Balance sheet included - mandatory field (מצורף דוח מאזן) */
  includesBalanceSheet: YesNo;
  /** Number of entries in profit and loss section (3 digits) - mandatory field (מספר נגררות פיסקת רווח הפסד) */
  profitLossEntryCount: number;
  /** Number of entries in tax adjustment section (3 digits) - mandatory if entries exist (מספר נגררות פיסקת התאמה למס) */
  taxAdjustmentEntryCount: number;
  /** Number of entries in balance sheet section (3 digits) - mandatory if entries exist (מספר נגררות פיסקת מאזן) */
  balanceSheetEntryCount: number;
  /**
   * Year when IFRS accounting standards were implemented (4 digits) (שנת מס - יישום תקני חשבונאות)
   * Starting from 2006, or 9999 if not applicable
   */
  ifrsImplementationYear?: string;
  /** IFRS reporting option (דווח בחלופה - יישום תקני חשבונאות) */
  ifrsReportingOption?: IfrsReportingOption;
  /** Software registration certificate number (8 digits) - 99999999 if not applicable (מספר תעודת רישום - חייב ברישום תוכנה) */
  softwareRegistrationNumber?: string;
  /** For partnership reports: number of partners (3 digits) - 999 if not applicable (דוח זה בגין שותפות: מספר השותפים) */
  partnershipCount?: number;
  /** For partnership reports: share in partnership profits (6 digits, 2 decimal places) - 999999 if not applicable (דוח זה בגין שותפות: חלקי ברווחי השותפות) */
  partnershipProfitShare?: number;
  /** Currency reporting type (דיווח מטבע) */
  currencyType: CurrencyType;
  /** Audit opinion type (חוות דעת) */
  auditOpinionType?: AuditOpinionType;
  /** Are amounts in thousands (הסכום באלפי שקלים/דולרים) */
  amountsInThousands: YesNo;
}

/**
 * Report Entry interface representing a single financial data entry in any report section
 * @export
 * @interface ReportEntry
 */
export interface ReportEntry {
  /** Field code from Form 6111 (5 digits) (קוד שדה) */
  code: string;
  /** Monetary amount (13 digits) - negative values have sign in leftmost position (סכום) */
  amount: number;
}
