import { HeaderRecord } from './header.js';

/**
 * Tax Reporting System Interfaces
 * Based on specifications for Form 6111 electronic filing (טופס 6111)
 */

/**
 * Business type enum (סוג עסק)
 * @export
 * @enum {string}
 */
export enum IndividualOrCompanyEnum {
  /** Individual (יחיד) */
  INDIVIDUAL = 'Individual',
  /** Company (חברה) */
  COMPANY = 'Company',
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
  /** Individual or Company type (יחיד או חברה) */
  individualOrCompany: IndividualOrCompanyEnum;
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
