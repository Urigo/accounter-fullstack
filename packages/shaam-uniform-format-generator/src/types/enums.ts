/**
 * SHAAM Uniform Format Enums and Code Tables
 * Based on SHAAM specification version 1.31
 */

import { z } from 'zod';

// ================================================================================
// RECORD TYPE CODES
// ================================================================================

/**
 * SHAAM Record Type Codes
 * Used to identify the type of each record in the format
 */
export const RecordTypeEnum = z.enum([
  'A000', // Header record (INI.TXT)
  'A100', // Business opening record
  'B100', // Journal entry line record
  'B110', // Account record
  'C100', // Document header record
  'D110', // Document line record
  'D120', // Payment/receipt record
  'M100', // Inventory item record
  'Z900', // Closing record
]);

export type RecordType = z.infer<typeof RecordTypeEnum>;

// ================================================================================
// DOCUMENT TYPES (Appendix 1)
// ================================================================================

/**
 * Document Type Enum for SHAAM format
 * Based on Appendix 1 of the SHAAM specification
 */
export const DocumentTypeEnum = z.enum([
  '100', // הזמנה - Order
  '200', // תעודת משלוח - Delivery Note
  '210', // תעודת החזרה - Return Note
  '300', // חשבונית / חשבונית עסקה - Invoice / Transaction Invoice
  '305', // חשבונית מס - Tax Invoice
  '320', // חשבונית מס קבלה - Receipt Tax Invoice
  '325', // תעודת זיכוי - Credit Note
  '330', // חשבונית מס זיכוי - Credit Tax Invoice
  '340', // קבלה - Receipt
  '400', // תעודת חיוב - Debit Note
  '410', // תעודת זיכוי כללי - General Credit Note
  '420', // תעודת העברה - Transfer Note
  '430', // מסמך רכש - Purchase Document
  '500', // חשבון ספק - Supplier Invoice
  '600', // קבלה מרוכזת - Consolidated Receipt
  '700', // חיוב/זיכוי כרטיס אשראי - Credit Card Charge/Credit
  '710', // קבלה - כרטיס אשראי - Credit Card Receipt
]);

export type DocumentType = z.infer<typeof DocumentTypeEnum>;

/**
 * Document Type Labels in Hebrew
 */
export const DocumentTypeLabels: Record<DocumentType, string> = {
  '100': 'הזמנה',
  '200': 'תעודת משלוח',
  '210': 'תעודת החזרה',
  '300': 'חשבונית / חשבונית עסקה',
  '305': 'חשבונית מס',
  '320': 'חשבונית מס קבלה',
  '325': 'תעודת זיכוי',
  '330': 'חשבונית מס זיכוי',
  '340': 'קבלה',
  '400': 'תעודת חיוב',
  '410': 'תעודת זיכוי כללי',
  '420': 'תעודת העברה',
  '430': 'מסמך רכש',
  '500': 'חשבון ספק',
  '600': 'קבלה מרוכזת',
  '700': 'חיוב/זיכוי כרטיס אשראי',
  '710': 'קבלה - כרטיס אשראי',
};

/**
 * Document Type Labels in English
 */
export const DocumentTypeLabelsEn: Record<DocumentType, string> = {
  '100': 'Order',
  '200': 'Delivery Note',
  '210': 'Return Note',
  '300': 'Invoice / Transaction Invoice',
  '305': 'Tax Invoice',
  '320': 'Receipt Tax Invoice',
  '325': 'Credit Note',
  '330': 'Credit Tax Invoice',
  '340': 'Receipt',
  '400': 'Debit Note',
  '410': 'General Credit Note',
  '420': 'Transfer Note',
  '430': 'Purchase Document',
  '500': 'Supplier Invoice',
  '600': 'Consolidated Receipt',
  '700': 'Credit Card Charge/Credit',
  '710': 'Credit Card Receipt',
};

// ================================================================================
// CURRENCY CODES (Appendix 2)
// ================================================================================

/**
 * Currency Code Enum for SHAAM format
 * Based on Appendix 2 of the SHAAM specification
 * Using ISO 4217 currency codes
 */
export const CurrencyCodeEnum = z.enum([
  'ILS', // Israeli New Shekel (שקל חדש)
  'USD', // US Dollar (דולר אמריקאי)
  'EUR', // Euro (יורו)
  'GBP', // British Pound (לירה שטרלינג)
  'JPY', // Japanese Yen (ין יפני)
  'CAD', // Canadian Dollar (דולר קנדי)
  'AUD', // Australian Dollar (דולר אוסטרלי)
  'CHF', // Swiss Franc (פרנק שוויצרי)
  'SEK', // Swedish Krona (כתר שוודי)
  'NOK', // Norwegian Krone (כתר נורווגי)
  'DKK', // Danish Krone (כתר דני)
  'CNY', // Chinese Yuan (יואן סיני)
  'HKD', // Hong Kong Dollar (דולר הונג קונג)
  'SGD', // Singapore Dollar (דולר סינגפורי)
  'NZD', // New Zealand Dollar (דולר ניו זילנדי)
  'ZAR', // South African Rand (ראנד דרום אפריקאי)
  'RUB', // Russian Ruble (רובל רוסי)
  'BRL', // Brazilian Real (ריאל ברזילאי)
  'MXN', // Mexican Peso (פסו מקסיקני)
  'INR', // Indian Rupee (רופי הודי)
  'THB', // Thai Baht (באט תאילנדי)
  'KRW', // South Korean Won (וון דרום קוריאני)
  'TRY', // Turkish Lira (לירה טורקית)
  'PLN', // Polish Zloty (זלוטי פולני)
  'CZK', // Czech Koruna (כתר צ'כי)
  'HUF', // Hungarian Forint (פורינט הונגרי)
]);

export type CurrencyCode = z.infer<typeof CurrencyCodeEnum>;

/**
 * Currency Labels in Hebrew
 */
export const CurrencyLabels: Record<CurrencyCode, string> = {
  ILS: 'שקל חדש',
  USD: 'דולר אמריקאי',
  EUR: 'יורו',
  GBP: 'לירה שטרלינג',
  JPY: 'ין יפני',
  CAD: 'דולר קנדי',
  AUD: 'דולר אוסטרלי',
  CHF: 'פרנק שוויצרי',
  SEK: 'כתר שוודי',
  NOK: 'כתר נורווגי',
  DKK: 'כתר דני',
  CNY: 'יואן סיני',
  HKD: 'דולר הונג קונג',
  SGD: 'דולר סינגפורי',
  NZD: 'דולר ניו זילנדי',
  ZAR: 'ראנד דרום אפריקאי',
  RUB: 'רובל רוסי',
  BRL: 'ריאל ברזילאי',
  MXN: 'פסו מקסיקני',
  INR: 'רופי הודי',
  THB: 'באט תאילנדי',
  KRW: 'וון דרום קוריאני',
  TRY: 'לירה טורקית',
  PLN: 'זלוטי פולני',
  CZK: 'כתר צכי',
  HUF: 'פורינט הונגרי',
};

// ================================================================================
// SOFTWARE AND SYSTEM ENUMS
// ================================================================================

/**
 * Software Type (Field 1011)
 * Type of accounting software
 */
export const SoftwareTypeEnum = z.enum(['1', '2']);
export type SoftwareType = z.infer<typeof SoftwareTypeEnum>;

export const SoftwareTypeLabels: Record<SoftwareType, string> = {
  '1': 'Single-year', // תוכנה חד-שנתית
  '2': 'Multi-year', // תוכנה רב-שנתית
};

/**
 * Accounting Type (Field 1013)
 * Type of bookkeeping system
 */
export const AccountingTypeEnum = z.enum(['0', '1', '2']);
export type AccountingType = z.infer<typeof AccountingTypeEnum>;

export const AccountingTypeLabels: Record<AccountingType, string> = {
  '0': 'N/A', // לא רלוונטי
  '1': 'Single-entry', // הנהלת חשבונות יחידה
  '2': 'Double-entry', // הנהלת חשבונות כפולה
};

/**
 * Balance Required Flag (Field 1014)
 * Whether balance verification is required
 */
export const BalanceRequiredEnum = z.enum(['0', '1']);
export type BalanceRequired = z.infer<typeof BalanceRequiredEnum>;

export const BalanceRequiredLabels: Record<BalanceRequired, string> = {
  '0': 'Not required', // לא נדרש
  '1': 'Required', // נדרש
};

/**
 * Language Code (Field 1031)
 * Language used in the report
 */
export const LanguageCodeEnum = z.enum(['0', '1', '2']);
export type LanguageCode = z.infer<typeof LanguageCodeEnum>;

export const LanguageCodeLabels: Record<LanguageCode, string> = {
  '0': 'Hebrew', // עברית
  '1': 'Arabic', // ערבית
  '2': 'Other', // אחר
};

/**
 * Character Encoding (Field 1032)
 * Character encoding used in the file
 */
export const CharacterEncodingEnum = z.enum(['1', '2']);
export type CharacterEncoding = z.infer<typeof CharacterEncodingEnum>;

export const CharacterEncodingLabels: Record<CharacterEncoding, string> = {
  '1': 'ISO-8859-8-i', // ISO-8859-8-i
  '2': 'CP-862', // CP-862
};

/**
 * Branch Info Flag (Field 1034)
 * Whether the business has branches
 */
export const BranchInfoFlagEnum = z.enum(['0', '1']);
export type BranchInfoFlag = z.infer<typeof BranchInfoFlagEnum>;

export const BranchInfoFlagLabels: Record<BranchInfoFlag, string> = {
  '0': 'No branches', // אין סניפים
  '1': 'Has branches', // יש סניפים
};

// ================================================================================
// TRANSACTION AND ACCOUNTING ENUMS
// ================================================================================

/**
 * Debit/Credit Indicator (Field 1366)
 * Whether the transaction is a debit or credit
 */
export const DebitCreditIndicatorEnum = z.enum(['1', '2']);
export type DebitCreditIndicator = z.infer<typeof DebitCreditIndicatorEnum>;

export const DebitCreditIndicatorLabels: Record<DebitCreditIndicator, string> = {
  '1': 'Debit', // חובה
  '2': 'Credit', // זכות
};

/**
 * Payment Method Codes
 * Common payment methods used in D120 records
 */
export const PaymentMethodEnum = z.enum([
  '1', // מזומן - Cash
  '2', // שיק - Check
  '3', // כרטיס אשראי - Credit Card
  '4', // העברה בנקאית - Bank Transfer
  '5', // הוראת קבע - Standing Order
  '6', // אחר - Other
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const PaymentMethodLabels: Record<PaymentMethod, string> = {
  '1': 'Cash', // מזומן
  '2': 'Check', // שיק
  '3': 'Credit Card', // כרטיס אשראי
  '4': 'Bank Transfer', // העברה בנקאית
  '5': 'Standing Order', // הוראת קבע
  '6': 'Other', // אחר
};

// ================================================================================
// ACCOUNT AND BUSINESS ENUMS
// ================================================================================

/**
 * Trial Balance Codes
 * Common account types used in chart of accounts
 */
export const TrialBalanceCodeEnum = z.enum([
  'Asset', // נכסים
  'Liability', // התחייבויות
  'Equity', // הון
  'Revenue', // הכנסות
  'Expense', // הוצאות
  'Other', // אחר
]);
export type TrialBalanceCode = z.infer<typeof TrialBalanceCodeEnum>;

export const TrialBalanceCodeLabels: Record<TrialBalanceCode, string> = {
  Asset: 'נכסים',
  Liability: 'התחייבויות',
  Equity: 'הון',
  Revenue: 'הכנסות',
  Expense: 'הוצאות',
  Other: 'אחר',
};

// ================================================================================
// COUNTRY CODES
// ================================================================================

/**
 * Country Codes (ISO 3166-1 alpha-2)
 * Used for addresses and international transactions
 */
export const CountryCodeEnum = z.enum([
  'IL', // Israel - ישראל
  'US', // United States - ארצות הברית
  'GB', // United Kingdom - בריטניה
  'DE', // Germany - גרמניה
  'FR', // France - צרפת
  'IT', // Italy - איטליה
  'ES', // Spain - ספרד
  'NL', // Netherlands - הולנד
  'BE', // Belgium - בלגיה
  'CH', // Switzerland - שוויץ
  'AT', // Austria - אוסטריה
  'SE', // Sweden - שוודיה
  'NO', // Norway - נורווגיה
  'DK', // Denmark - דנמרק
  'FI', // Finland - פינלנד
  'IE', // Ireland - אירלנד
  'PT', // Portugal - פורטוגל
  'GR', // Greece - יוון
  'PL', // Poland - פולין
  'CZ', // Czech Republic - צ'כיה
  'HU', // Hungary - הונגריה
  'SK', // Slovakia - סלובקיה
  'SI', // Slovenia - סלובניה
  'HR', // Croatia - קרואטיה
  'BG', // Bulgaria - בולגריה
  'RO', // Romania - רומניה
  'LT', // Lithuania - ליטא
  'LV', // Latvia - לטביה
  'EE', // Estonia - אסטוניה
  'MT', // Malta - מלטה
  'CY', // Cyprus - קפריסין
  'LU', // Luxembourg - לוקסמבורג
  'CA', // Canada - קנדה
  'MX', // Mexico - מקסיקו
  'JP', // Japan - יפן
  'CN', // China - סין
  'KR', // South Korea - דרום קוריאה
  'IN', // India - הודו
  'AU', // Australia - אוסטרליה
  'NZ', // New Zealand - ניו זילנד
  'ZA', // South Africa - דרום אפריקה
  'BR', // Brazil - ברזיל
  'AR', // Argentina - ארגנטינה
  'CL', // Chile - צ'ילה
  'SG', // Singapore - סינגפור
  'HK', // Hong Kong - הונג קונג
  'TH', // Thailand - תאילנד
  'MY', // Malaysia - מלזיה
  'ID', // Indonesia - אינדונזיה
  'PH', // Philippines - פיליפינים
  'VN', // Vietnam - וייטנאם
  'AE', // United Arab Emirates - איחוד האמירויות הערביות
  'SA', // Saudi Arabia - סעודיה
  'EG', // Egypt - מצרים
  'TR', // Turkey - טורקיה
  'RU', // Russia - רוסיה
  'UA', // Ukraine - אוקראינה
]);

export type CountryCode = z.infer<typeof CountryCodeEnum>;

/**
 * Country Labels in Hebrew
 */
export const CountryLabels: Record<CountryCode, string> = {
  IL: 'ישראל',
  US: 'ארצות הברית',
  GB: 'בריטניה',
  DE: 'גרמניה',
  FR: 'צרפת',
  IT: 'איטליה',
  ES: 'ספרד',
  NL: 'הולנד',
  BE: 'בלגיה',
  CH: 'שוויץ',
  AT: 'אוסטריה',
  SE: 'שוודיה',
  NO: 'נורווגיה',
  DK: 'דנמרק',
  FI: 'פינלנד',
  IE: 'אירלנד',
  PT: 'פורטוגל',
  GR: 'יוון',
  PL: 'פולין',
  CZ: 'צכיה',
  HU: 'הונגריה',
  SK: 'סלובקיה',
  SI: 'סלובניה',
  HR: 'קרואטיה',
  BG: 'בולגריה',
  RO: 'רומניה',
  LT: 'ליטא',
  LV: 'לטביה',
  EE: 'אסטוניה',
  MT: 'מלטה',
  CY: 'קפריסין',
  LU: 'לוקסמבורג',
  CA: 'קנדה',
  MX: 'מקסיקו',
  JP: 'יפן',
  CN: 'סין',
  KR: 'דרום קוריאה',
  IN: 'הודו',
  AU: 'אוסטרליה',
  NZ: 'ניו זילנד',
  ZA: 'דרום אפריקה',
  BR: 'ברזיל',
  AR: 'ארגנטינה',
  CL: 'צילה',
  SG: 'סינגפור',
  HK: 'הונג קונג',
  TH: 'תאילנד',
  MY: 'מלזיה',
  ID: 'אינדונזיה',
  PH: 'פיליפינים',
  VN: 'וייטנאם',
  AE: 'איחוד האמירויות הערביות',
  SA: 'סעודיה',
  EG: 'מצרים',
  TR: 'טורקיה',
  RU: 'רוסיה',
  UA: 'אוקראינה',
};

// ================================================================================
// UTILITY TYPES AND UNIONS
// ================================================================================

/**
 * All available enums as a union for type checking
 */
export type ShaamEnum =
  | RecordType
  | DocumentType
  | CurrencyCode
  | SoftwareType
  | AccountingType
  | BalanceRequired
  | LanguageCode
  | CharacterEncoding
  | BranchInfoFlag
  | DebitCreditIndicator
  | PaymentMethod
  | TrialBalanceCode
  | CountryCode;

/**
 * Enum validation schemas for use in other parts of the application
 */
export const ShaamEnumSchemas = {
  RecordType: RecordTypeEnum,
  DocumentType: DocumentTypeEnum,
  CurrencyCode: CurrencyCodeEnum,
  SoftwareType: SoftwareTypeEnum,
  AccountingType: AccountingTypeEnum,
  BalanceRequired: BalanceRequiredEnum,
  LanguageCode: LanguageCodeEnum,
  CharacterEncoding: CharacterEncodingEnum,
  BranchInfoFlag: BranchInfoFlagEnum,
  DebitCreditIndicator: DebitCreditIndicatorEnum,
  PaymentMethod: PaymentMethodEnum,
  TrialBalanceCode: TrialBalanceCodeEnum,
  CountryCode: CountryCodeEnum,
} as const;

/**
 * All label mappings for easy lookup
 */
export const ShaamLabels = {
  DocumentType: DocumentTypeLabels,
  DocumentTypeEn: DocumentTypeLabelsEn,
  Currency: CurrencyLabels,
  SoftwareType: SoftwareTypeLabels,
  AccountingType: AccountingTypeLabels,
  BalanceRequired: BalanceRequiredLabels,
  LanguageCode: LanguageCodeLabels,
  CharacterEncoding: CharacterEncodingLabels,
  BranchInfoFlag: BranchInfoFlagLabels,
  DebitCreditIndicator: DebitCreditIndicatorLabels,
  PaymentMethod: PaymentMethodLabels,
  TrialBalanceCode: TrialBalanceCodeLabels,
  Country: CountryLabels,
} as const;

// ================================================================================
// CONSTANTS
// ================================================================================

/**
 * SHAAM System Constants
 */
export const SHAAM_CONSTANTS = {
  VERSION: '&OF1.31&',
  DEFAULT_CURRENCY: 'ILS' as CurrencyCode,
  DEFAULT_LANGUAGE: '0' as LanguageCode,
  DEFAULT_ENCODING: '1' as CharacterEncoding,
  DEFAULT_SOFTWARE_TYPE: '2' as SoftwareType,
  DEFAULT_ACCOUNTING_TYPE: '2' as AccountingType,
  DEFAULT_BALANCE_REQUIRED: '1' as BalanceRequired,
  DEFAULT_BRANCH_INFO: '0' as BranchInfoFlag,
} as const;
