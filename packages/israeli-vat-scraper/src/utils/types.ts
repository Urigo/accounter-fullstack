export interface ReportCommon {
  /**
   * תקופת הדיווח
   */
  reportMonth: string;
  /**
   * סוג הדוח
   */
  reportType: string;
  /**
   * תקינות
   */
  corectness: string;
  /**
   * סכום מדווח
   */
  totalVat: number;
  /**
   * תאריך הגשה
   */
  generationDate: string;
  /**
   * מסלול
   */
  route: string;
  /**
   * האם תוקן
   */
  isFixed: boolean;
}

export interface Report extends ReportCommon {
  /**
   * פרטים נוספים
   */
  additionalDetails?: ReportDetails;
  /**
   *  פירוט הדוח
   */
  reportExpansion?: ReportExpansion;
}

export interface ReportDetails {
  /**
   * מספר עוסק
   */
  licensedDealerId: string;
  /**
   * שם עוסק	אורי גולדשטיין בע"מ
   */
  osekName: string;
  /**
   * ממונה אזורי
   */
  regionalCommissioner: string;
  /**
   * תקופת הדווח
   */
  reportingPeriod: string;
  /**
   * מקור הדווח
   */
  reportingOrigin: string;
  /**
   * תאריך הדווח
   */
  reportingDate: string;
  /**
   * מצב הדווח
   */
  reportingStatus: string;
  /**
   * עסקאות חייבות
   */
  taxableSalesAmount: number;
  /**
   * מע"מ עסקאות חייבות
   */
  taxableSalesVat: number;
  /**
   * עסקאות פטורות / אפס
   */
  zeroOrExemptSalesCount: number;
  /**
   * תשומות ציוד
   */
  equipmentInputsVat: number;
  /**
   * תשומות אחרות
   */
  otherInputsVat: number;
  /**
   * סכום להחזר
   */
  refundAmount: number;
  /**
   * רשומת חשבונית מהקובץ
   */
  fileInvoiceRecord: string;
}

export interface ReportExpansion {
  /**
   * תקופת הדווח
   */
  reportingPeriod: string;
  /**
   * מקור הדווח
   */
  reportingOrigin: string;
  /**
   * תאריך הדווח
   */
  reportingDate: string;
  /**
   * עסקאות חייבות
   */
  taxableSalesAmount: number;
  /**
   * מע"מ עסקאות חייבות
   */
  taxableSalesVat: number;
  /**
   * עסקאות פטורות / אפס
   */
  zeroOrExemptSalesCount: number;
  /**
   * תשומות ציוד
   */
  equipmentInputsVat: number;
  /**
   * תשומות אחרות
   */
  otherInputsVat: number;
  /**
   * סכום להחזר
   */
  refundAmount: number;
  /**
   * תשומות
   */
  inputs?: ReportInputs;
  /**
   * עסקאות
   */
  sales?: ReportSales;
  /**
   * חשבוניות שתוקנו
   */
  fixedInvoices?: ReportFixedInvoice[];
}

export interface ReportInputs {
  /**
   * תשומה רגילה
   */
  regularInput: ReportRecordCategories;
  /**
   * קופה קטנה
   */
  pettyCash: ReportRecordCategories;
  /**
   * חשבונית עצמית (תשומה)
   */
  selfInvoiceInput: ReportRecordCategories;
  /**
   * רשימון יבוא
   */
  importList: ReportRecordCategories;
  /**
   * ספק רש"פ
   */
  rashapSupplier: ReportRecordCategories;
  /**
   * מסמך אחר
   */
  otherDocument: ReportRecordCategories;
  /**
   * סה"כ
   */
  total: ReportRecordCategories;
}

export interface ReportSales {
  /**
   * עסקה רגילה - מזוהה
   */
  regularSaleRecognized: ReportRecordCategories;
  /**
   * עסקה אפס - מזוהה
   */
  zeroSaleRecognized: ReportRecordCategories;
  /**
   * עסקה רגילה - לא מזוהה
   */
  regularSaleUnrecognized: ReportRecordCategories;
  /**
   * עסקה אפס - לא מזוהה
   */
  zeroSaleUnrecognized: ReportRecordCategories;
  /**
   * חשבונית עצמית (עסקה)
   */
  selfInvoiceSale: ReportRecordCategories;
  /**
   * רשימון יצוא
   */
  listExport: ReportRecordCategories;
  /**
   * יצוא שירותים
   */
  servicesExport: ReportRecordCategories;
  /**
   * לקוח רש"פ
   */
  rashapClient: ReportRecordCategories;
  /**
   * סה"כ
   */
  total: ReportRecordCategories;
}

export interface ReportRecordCategories {
  /**
   * נתקבל (100%)
   */
  received: ReportRecordColumns;
  /**
   * שגוי
   */
  incorrect: ReportRecordColumns;
  /**
   * סיכום
   */
  total: ReportRecordColumns;
}

export interface ReportRecordColumns {
  /**
   * מס' תנועות
   */
  recordsCount: number;
  /**
   * סכום מע"מ
   */
  vatAmount: number;
  /**
   * סכום לפני מע"מ
   */
  beforeVatAmount: number;
  records?: ReportInputRecord[];
}

export interface ReportInputRecord {
  /**
   * סוג רשומה
   */
  recordType: string;
  /**
   * מספר אסמכתא
   */
  referenceNum: string;
  /**
   * תאריך החשבונית
   */
  invoiceDate: string;
  /**
   * סכום המע"מ
   */
  vatAmount: number;
  /**
   * סכום
   */
  amount: number;
  /**
   * ספק / רשימון
   */
  supplierOrList: string;
  /**
   * תאור שגיאה
   */
  errorDescription: string;
  /**
   * פרטים נוספים
   */
  details?: ReportInputRecordDetails;
}

export interface ReportInputRecordDetails {
  /**
   * סוג רשומה
   */
  recordType: string;
  /**
   * מספר חשבונית
   */
  invoiceNum: string;
  /**
   * קבוצת אסמכתא
   */
  referenceGroup: string;
  /**
   * תאריך החשבונית
   */
  invoiceDate: string;
  /**
   * סכום המע"מ
   */
  vatAmount: number;
  /**
   * סכום
   */
  amount: number;
  /**
   * ספק / רשימון
   */
  supplierOrList: string;
}

export interface ReportFixedInvoice {
  /**
   * סוג
   */
  saleType: string;
  /**
   * מס' אסמכתא
   */
  referenceNum: string;
  /**
   * תאריך החשבונית
   */
  invoiceDate: string;
  /**
   * סכום החשבונית
   */
  invoiceAmount: number;
  /**
   * סכום המע'מ
   */
  vatAmount: number;
  /**
   * מוציא/מקבל
   */
  expenderOrRecoever: string;
  /**
   * פרטי תיקון
   */
  fixDetails: string;
}

export interface Config {
  /**
   * Defines whether scraping browser will be visible
   * default: false
   */
  visibleBrowser: boolean;
  /**
   * Defines whether to fetch reportExpansion data
   * default: true
   */
  expandData: boolean;
  /**
   * Results are sorted ascending by default.
   * Raising this flag will sort data in descending order
   * default: false
   */
  sortDescending: boolean;
  /**
   * Defined whether the data will be schema-validated.
   * default: true
   */
  validate: boolean;
  /**
   * Occasionally, an error might accure in one of the sub-fields fetch proccess.
   * The app will not stop for errors, but move on.
   * This flag will print all this runtime errors, if any.
   * default: true
   */
  printErrors: boolean;
  /**
   * Optional config. limits the data being fetched to specific years or months.
   * Example of fetching all months of 2019-2020:
   *   [2019, 2020]
   * User can also select months, by replacing the year number with a tuple of year and months array.
   * For example, for fetching Jan-Feb of years 2019-2020:
   *   [ [2019, [1, 2]], [2020, [1, 2]] ]
   * default is null (no limitation, fetch all).
   */
  years: (number | [number, number[]])[] | undefined;
  /**
   * Logger
   */
  logger: Logger;
}

export interface UserCredentials {
  vatNumber: string;
  userCode: string;
  userPass: string;
}

export type Logger = Console;
