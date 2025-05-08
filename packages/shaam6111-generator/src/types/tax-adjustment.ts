/**
 * Tax Adjustment Record Interfaces
 * Based on the SHAAM 6111 specification (IncomeTax_software-houses-6111-2023.pdf)
 */

// Section 1.20
export const SECTION_1_20 = [
  // הוסף - התאמות שונות
  110, 120, 130, 135, 140, 150, 160, 170, 180, 181, 182, 183, 184, 190, 200,
  // פחת - התאמות שונות
  300, 310, 320, 330, 350, 360,
  // סך ההתאמות לפי דיני המס
  370,
] as const;
// Section 1.24
export const SECTION_1_24 = [
  // הפחת - התאמות אחרות
  430, 480, 490,
  // סה"כ הכנסה חייבת/הפסד
  500,
] as const;
// Section 1.25
export const SECTION_1_25 = [
  // הוסף - התאמות אחרות
  510, 520, 530, 540, 550, 570, 575, 580, 585, 590,
] as const;

// List of valid codes for Tax Adjustment records (דו"ח התאמה למס)
// Codes are from sections 1.17-1.26 in the SHAAM 6111 specification document
export const ALLOWED_TAX_ADJUSTMENT_CODES = [
  // רווח/הפסד לפי דו"ח רווח והפסד
  100,
  // הפרשים זמניים (הוצאות עודפות וכו')
  103,
  // רווח/הפסד חשבונאי לפני תקני דווח ישראליים
  104,
  ...SECTION_1_20,
  // התאמות נוספות לפי IFRS
  383,
  // הכנסה חייבת לפני יישום הוראות חוק נוספות
  400,
  ...SECTION_1_24,
  ...SECTION_1_25,
  // הכנסה מועברת לטופס 1301/1214
  600,
] as const;

// Create a type for the allowed codes
export type AllowedTaxAdjustmentCode = (typeof ALLOWED_TAX_ADJUSTMENT_CODES)[number];

// Codes that can have negative values (1.64-1.72 in the document)
export const NEGATIVE_ALLOWED_TAX_ADJUSTMENTS_CODES = [
  100, 103, 104, 135, 140, 150, 160, 170, 180, 300, 320, 330, 350, 360, 370, 383, 400, 490, 500,
  520, 530, 540, 600,
] as const;

// Define the summary codes that should equal the sum of their subsections
export const COMMON_TAX_ADJUSTMENTS_SUMMARY_CODES = [100, 103, 104, 383] as const;

// Define the summary codes that are not simple sums
export const UNCOMMON_TAX_ADJUSTMENTS_SUMMARY_CODES = [370, 400, 500, 600] as const;

export const _TAX_ADJUSTMENTS_SUMMARY_CODES = [
  ...COMMON_TAX_ADJUSTMENTS_SUMMARY_CODES,
  ...UNCOMMON_TAX_ADJUSTMENTS_SUMMARY_CODES,
] as const;

export type TaxAdjustmentSummaryCode = (typeof _TAX_ADJUSTMENTS_SUMMARY_CODES)[number];

export const TAX_ADJUSTMENT_CODE_NAMES: Record<AllowedTaxAdjustmentCode, string> = {
  100: 'רווח/הפסד לפני מסים',
  103: 'סך התאמות חשבוניות בעקבות השלכות IFRS',
  104: 'רווח/הפסד חשבונאי לפי תקני דיווח ישראליים (ללא תקן 29)',
  110: 'עודפות הוצאות',
  120: 'בספרים פחת',
  130: 'מס לצרכי פחת',
  135: 'הוצאות/הכנסות משיערוך נכסים/התחייבויות פיננסיות',
  140: 'עליה/ירידה בהפרשה לחובות מסופקים',
  150: 'עליה/ירידה בהפרשה לחופשה והבראה',
  160: 'עליה/ירידה בעתודה נטו לפיצויים',
  170: 'רווח/הפסד הון ממימוש רכוש קבוע',
  180: 'רווחים/הפסדים שנצברו על ניירות ערך סחירים',
  181: 'אופציות לעובדים ההוצאות בגין',
  182: 'הוצאות מימון בגין חוב מס',
  183: 'הוצאות בגין תרומות',
  184: 'הפחתה בגין השקעה במניות חברה מזכה',
  190: 'הוצאות אחרות לתיאום',
  200: 'הכנסות אחרות לתיאום',
  300: 'חלק ברווחי/הפסדי עסקה משותפת בספרים',
  310: 'הוצאות שיוחסו השנה לפי סעיף 18(ד) לפקודה',
  320: 'הפחתה/הוספה להכנסה החייבת עקב הפרשים בין רווח/הפסד חשבונאי לרווח לפי סעיף 18(ד) לפקודה בניכוי בשנת המס',
  330: 'הפחתה/הוספה להכנסה החייבת בגין רווח/הפסד חשבונאי לרווח לפי סעיף 8א לפקודה',
  350: 'חלק ברווחי/הפסדי עסקה משותפת לצורכי מס',
  360: 'השפעת הדיווח לפי התקנות הדולריות',
  370: 'סך התאמות לפי דיני מס',
  383: 'סך התאמות חשבוניות בעקבות השלכות IFRS',
  400: 'הכנסה חייבת לפני יישום הוראות חוק נוספות',
  430: 'ניכוי בשל פחת',
  480: 'הפסדים משנים קודמות',
  490: 'הכנסה חייבת/הפסד מחברה מאוחדת לפי חוק עידוד תעשייה מסים',
  500: 'סה"כ הכנסה חייבת/הפסד',
  510: 'הכנסה חייבת במס בשיעור מיוחד',
  520: 'רווח הון ריאלי',
  530: 'רווח הון אינפלציוני',
  540: 'שבח מקרקעין',
  550: 'הפסד הון להעברה',
  570: 'הפסד ריאלי מניירות ערך משנת 2005',
  575: 'הכנסה פטורה ממפעל מאושר במסלול חלופי/ממפעל מוטב בשנת המס',
  580: 'יתרת הכנסה שהופטרה במסלול חלופי/במפעל מוטב וטרם חולקה',
  585: 'סה"כ דיבידנד שחולק',
  590: 'מס חברות בגין חלוקת דיבידנד מהכנסה פטורה במסלול חלופי/במפעל מוטב',
  600: 'חלקי %____ בהכנסה חייבת/הפסד מהשותפות',
};
