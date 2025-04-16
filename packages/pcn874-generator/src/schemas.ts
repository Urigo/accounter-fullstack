import { z } from 'zod';
import { EntryType } from './types.js';
import {
  addLeadingZeros,
  cleanNonDigitChars,
  digitsAdjuster,
  numToSignedString,
} from './utils/index.js';

const DIGITS_REGEX = /^\d+$/;
const MONTH_REGEX = /^(20\d{2})(?:0[1-9]|1[0-2])$/;
const DATE_REGEX = /^(20\d{2})(?:0[1-9]|1[0-2])(?:0[1-9]|[1-2][0-9]|3[0-1])$/;

// most strict requirements
export const headerStrictSchema = z
  .object({
    licensedDealerId: z
      .string()
      .length(9, "Dealer's license ID must include 9 digits")
      .regex(DIGITS_REGEX, 'Only digits are allowed'),
    reportMonth: z.string().length(6).regex(MONTH_REGEX, 'Dates must be in YYYYMM format'),
    generationDate: z
      .string()
      .length(8, 'Dates must be in YYYYMMDD format')
      .regex(DATE_REGEX, 'Dates must be in YYYYMMDD format'),
    taxableSalesAmount: z.number().transform(value => numToSignedString(value, 11)),
    taxableSalesVat: z.number().transform(value => numToSignedString(value, 9)),
    salesRecordCount: z
      .number()
      .int()
      .min(0, 'Sales record count must be >= 0')
      .transform(value => addLeadingZeros(value, 9)),
    zeroValOrExemptSalesCount: z
      .number()
      .int()
      .transform(value => numToSignedString(value, 11)),
    otherInputsVat: z.number().transform(value => numToSignedString(value, 9)),
    equipmentInputsVat: z.number().transform(value => numToSignedString(value, 9)),
    inputsCount: z
      .number()
      .int()
      .min(0, 'Inputs count must be >= 0')
      .transform(value => addLeadingZeros(value, 9)),
    totalVat: z.number().transform(value => numToSignedString(value, 11)),
  })
  .strict();

// transformations that can be preformed by generator in non-strict mode
export const headerTransformerSchema = z
  .object({
    licensedDealerId: z.string().transform(id => digitsAdjuster(id, 9)),
    reportMonth: z.string(),
    generationDate: z
      .string()
      .optional()
      .transform(date => {
        {
          if (date) return date;

          // if not provided - use current date
          const now = new Date();
          const year = now.getUTCFullYear();
          const month = `0${now.getUTCMonth() + 1}`.slice(-2);
          const day = `0${now.getUTCDate()}`.slice(-2);
          return `${year}${month}${day}`;
        }
      }),
    taxableSalesAmount: z.number(),
    taxableSalesVat: z.number(),
    salesRecordCount: z.number().int(),
    zeroValOrExemptSalesCount: z.number().int(),
    otherInputsVat: z.number(),
    equipmentInputsVat: z.number(),
    inputsCount: z.number().int(),
    totalVat: z.number(),
  })
  .strict();

// most basic requirements + obvious transformations
export const headerCoreSchema = z.object({
  /**
   * User Licensed Dealer identification Number
   * 9 digits
   * מספר עוסק
   */
  licensedDealerId: z.string().transform(id => cleanNonDigitChars(id)),
  /**
   * Month for which detailed report is being submitted
   * YYYYMM
   * תקופת הדיווח
   */
  reportMonth: z.string().length(6).regex(MONTH_REGEX, 'Dates must be in YYYYMM format'),
  /**
   * File Generation Date
   * YYYYMM
   * if undefined - current date will be inputed
   * תאריך הגשה
   */
  generationDate: z
    .string()
    .length(8)
    .regex(DATE_REGEX, 'Dates must be in YYYYMMDD format')
    .optional(),
  /**
   * Total amount of taxable sales (excluding VAT)
   * in the reported file
   * עסקאות חייבות
   */
  taxableSalesAmount: z.number(),
  /**
   * Total VAT on taxable sales
   * in the reported file
   * מע"מ עסקאות חייבות
   */
  taxableSalesVat: z.number(),
  /**
   * Total number of records for "sales".
   * Number of sales records - both taxable and zero-rated/ exempt
   * מס' עסקאות
   */
  salesRecordCount: z.number().int(),
  /**
   * Total of zero value/exempt sales for period
   * עסקאות פטורות / אפס
   */
  zeroValOrExemptSalesCount: z.number().int(),
  /**
   * Total VAT on "other" inputs required during period
   * תשומות אחרות
   */
  otherInputsVat: z.number(),
  /**
   * Total VAT on "equipment" inputs required during period
   * תשומות ציוד
   */
  equipmentInputsVat: z.number(),
  /**
   * Total number of records for inputs (other and equipment)
   * מס' תשומות
   */
  inputsCount: z.number().int(),
  /**
   * Total VAT to pay / receive for period
   * positive value => pay
   * negative value => receive
   * סכום מדווח
   */
  totalVat: z.number(),
});

export type HeaderStrict = z.infer<typeof headerStrictSchema>;
export type HeaderTransformer = z.infer<typeof headerTransformerSchema>;
export type HeaderCore = z.infer<typeof headerCoreSchema>;

// most strict requirements
export const transactionStrictSchema = z
  .object({
    entryType: z.nativeEnum(EntryType).transform(entryType => entryType.valueOf()[0]),
    vatId: z.string().length(9).regex(DIGITS_REGEX, 'Only digits are allowed'),
    allocationNumber: z.string().length(9).regex(DIGITS_REGEX, 'Only digits are allowed'),
    invoiceDate: z.string().length(8).regex(DATE_REGEX, 'Dates must be in YYYYMMDD format'),
    refGroup: z.string().length(4),
    refNumber: z.string().length(9).regex(DIGITS_REGEX, 'Only digits are allowed'),
    totalVat: z
      .number()
      .int()
      .transform(value => addLeadingZeros(value, 9)),
    invoiceSum: z
      .number()
      .int()
      .transform(value => numToSignedString(value, 10)),
  })
  .strict()
  .refine(transaction => {
    switch (transaction.entryType) {
      case EntryType.SALE_ZERO_OR_EXEMPT: {
        if (transaction.totalVat !== '000000000') {
          throw new Error(
            `Transactions of entry type "SALE_ZERO_OR_EXEMPT" VAT should be 0, received "${transaction.totalVat}". Replacing with 0`,
          );
        }
        break;
      }
      case EntryType.SALE_UNIDENTIFIED_CUSTOMER: {
        if (transaction.vatId !== '000000000') {
          throw new Error(
            `Transactions of entry type "SALE_UNIDENTIFIED_CUSTOMER" should not include vatId, received "${transaction.vatId}".`,
          );
        }
        break;
      }
      case EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT: {
        if (transaction.vatId !== '000000000') {
          throw new Error(
            `Transactions of entry type "SALE_UNIDENTIFIED_ZERO_OR_EXEMPT" should not include vatId, received "${transaction.vatId}".`,
          );
        }

        if (transaction.totalVat !== '000000000') {
          throw new Error(
            `Transactions of entry type "SALE_UNIDENTIFIED_ZERO_OR_EXEMPT" VAT should be 0, received "${transaction.totalVat}". Replacing with 0`,
          );
        }
        break;
      }
      case EntryType.SALE_EXPORT: {
        if (transaction.totalVat !== '000000000') {
          throw new Error(
            `Transactions of entry type "SALE_EXPORT" should not include totalVat, received "${transaction.totalVat}"`,
          );
        }
        break;
      }
      case EntryType.INPUT_PETTY_CASH: {
        if (transaction.vatId !== '000000000') {
          throw new Error(
            `Transactions of entry type "INPUT_PETTY_CASH" should not include vatId, received "${transaction.vatId}".`,
          );
        }

        if (transaction.refNumber !== '000000000') {
          throw new Error(
            `On transactions of entry type "INPUT_PETTY_CASH", refNumber should reflect the number of invoices in the entry (hence > 0), received "${transaction.refNumber}"`,
          );
        }
        break;
      }
      case EntryType.INPUT_IMPORT: {
        if (transaction.refNumber !== '000000000') {
          throw new Error(
            `Transactions of entry type "INPUT_IMPORT" should not include refNumber, received "${transaction.refNumber}".`,
          );
        }
        break;
      }
    }
    return transaction;
  });

// transformations that can be preformed by generator in non-strict mode
export const transactionTransformerSchema = z
  .object({
    allocationNumber: z
      .string()
      .optional()
      .transform(allocationNumber => digitsAdjuster(allocationNumber ?? '', 9)),
    entryType: z.nativeEnum(EntryType),
    invoiceDate: z.string(),
    invoiceSum: z.number().int(),
    refGroup: z
      .string()
      .optional()
      .transform(refGroup => digitsAdjuster(refGroup ?? '', 4)),
    refNumber: z
      .string()
      .optional()
      .transform(refNumber => digitsAdjuster(refNumber ?? '', 9)),
    totalVat: z.number().int().optional(),
    vatId: z
      .string()
      .optional()
      .transform(id => digitsAdjuster(id ?? '', 9)),
  })
  .strict()
  .refine(transaction => {
    switch (transaction.entryType) {
      case EntryType.SALE_REGULAR: {
        if (transaction.invoiceSum <= 5000) {
          transaction.vatId ??= '000000000';
        }
        break;
      }
      case EntryType.SALE_ZERO_OR_EXEMPT: {
        if (transaction.totalVat && transaction.totalVat !== 0) {
          transaction.totalVat = 0;
        }

        if (transaction.invoiceSum <= 5000) {
          transaction.vatId ??= '000000000';
        }
        break;
      }
      case EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT: {
        if (transaction.totalVat && transaction.totalVat !== 0) {
          transaction.totalVat = 0;
        }
        break;
      }
      case EntryType.SALE_EXPORT: {
        transaction.vatId ??= '999999999';
        break;
      }
      case EntryType.INPUT_SINGLE_DOC_BY_LAW: {
        transaction.refNumber ??= '000000000';
        break;
      }
    }
    return transaction;
  });

// most basic requirements + obvious transformations
export const transactionCoreSchema = z.object({
  /**
   * Entry Type (document type)
   * סוג רשומה
   */
  entryType: z.nativeEnum(EntryType),
  /**
   * VAT identification number – of the other side of the transaction.
   * For transactions entries – the customer
   * For inputs – the supplier
   * ספק / רשימון
   */
  vatId: z
    .string()
    .optional()
    .transform(id => (id ? cleanNonDigitChars(id) : undefined)),
  /**
   * Short allocation number – last 9 digits of full number.
   * מספר הקצאה קצר
   */
  allocationNumber: z
    .string()
    .optional()
    .transform(allocationNumber =>
      allocationNumber ? cleanNonDigitChars(allocationNumber) : undefined,
    ),
  /**
   * Invoice Date/Reference.
   * YYYYMMDD
   * תאריך החשבונית
   */
  invoiceDate: z.string().length(8).regex(DIGITS_REGEX, 'Only digits are allowed'),
  /**
   * Reference group.
   * Series etc. zeros are possible at this stage
   * קבוצת אסמכתא
   */
  refGroup: z
    .string()
    .optional()
    .transform(refGroup => (refGroup ? cleanNonDigitChars(refGroup) : undefined)),
  /**
   * Reference number.
   * First 9 positions from the right
   * מספר אסמכתא
   */
  refNumber: z
    .string()
    .optional()
    .transform(refNumber => (refNumber ? cleanNonDigitChars(refNumber) : undefined)),
  /**
   * Total VAT in invoice / total VAT that is allowed (1/4…. 2/3…).
   * Rounded to the nearest shekel – always a positive value
   * סכום המע"מ
   */
  totalVat: z.number().int().min(0).optional(),
  /**
   * Invoice total (excluding VAT)
   * Always the 100%, always a positive value, rounded to the nearest shekel
   * סכום
   */
  invoiceSum: z.number().int(),
});

export type TransactionStrict = z.infer<typeof transactionStrictSchema>;
export type TransactionTransformer = z.infer<typeof transactionTransformerSchema>;
export type TransactionCore = z.infer<typeof transactionCoreSchema>;
