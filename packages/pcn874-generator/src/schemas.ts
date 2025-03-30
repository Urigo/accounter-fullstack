import { z } from 'zod';
import { EntryType } from './types.js';
import { digitsAdjuster, numToSignedString } from './utils/index.js';

export const headerStrictSchema = z
  .object({
    licensedDealerId: z
      .string()
      .length(9, "Dealer's license ID must include 9 digits")
      .regex(/^\d+$/, 'Only digits are allowed'),
    reportMonth: z
      .string()
      .length(6)
      .regex(/^(20\d{2})(?:0[1-9]|1[0-2])$/, 'Dates must be in YYYYMM format'),
    generationDate: z
      .string()
      .length(6, 'Dates must be in YYYYMM format')
      .regex(/^(20\d{2})(?:0[1-9]|1[0-2])$/, 'Dates must be in YYYYMM format'),
    taxableSalesAmount: z.number().transform(value => numToSignedString(value, 11)),
    taxableSalesVat: z.number().transform(value => numToSignedString(value, 9)),
    salesRecordCount: z
      .number()
      .int()
      .min(0, 'Sales record count must be >= 0')
      .transform(value => numToSignedString(value, 9)),
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
      .transform(value => numToSignedString(value, 9)),
    totalVat: z.number().transform(value => numToSignedString(value, 11)),
  })
  .strict();

export const headerTransformerSchema = z
  .object({
    licensedDealerId: z.string().transform(id => digitsAdjuster(id, 9)),
    reportMonth: z.string(),
    generationDate: z.string(),
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

export const headerCoreSchema = z
  .object({
    /**
     * User Licensed Dealer identification Number
     * 9 digits
     * מספר עוסק
     */
    licensedDealerId: z.string(),
    /**
     * Month for which detailed report is being submitted
     * YYYYMM
     * תקופת הדיווח
     */
    reportMonth: z
      .string()
      .length(6)
      .regex(/^(20\d{2})(?:0[1-9]|1[0-2])$/, 'Dates must be in YYYYMM format'),
    /**
     * File Generation Date
     * YYYYMM
     * if undefined - current date will be inputed
     * תאריך הגשה
     */
    generationDate: z
      .string()
      .length(6)
      .regex(/^(20\d{2})(?:0[1-9]|1[0-2])$/, 'Dates must be in YYYYMM format')
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
  })
  .strict();

export type HeaderStrict = z.infer<typeof headerStrictSchema>;
export type HeaderTransformer = z.infer<typeof headerTransformerSchema>;
export type HeaderCore = z.infer<typeof headerCoreSchema>;

export const transactionStrictSchema = z
  .object({
    entryType: z.nativeEnum(EntryType),
    vatId: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed'),
    allocationNumber: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed'),
    invoiceDate: z.string().length(8).regex(/^\d+$/, 'Only digits are allowed'),
    refGroup: z.string().length(4),
    refNumber: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed'),
    totalVat: z.number().int(),
    invoiceSum: z.number().int().min(0),
  })
  .strict();

export const transactionCoreSchema = z
  .object({
    entryType: z.nativeEnum(EntryType),
    vatId: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed').optional(),
    allocationNumber: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed').optional(),
    invoiceDate: z.string().length(8).regex(/^\d+$/, 'Only digits are allowed'),
    refGroup: z.string().length(4).optional(),
    refNumber: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed').optional(),
    totalVat: z.number().int().optional(),
    invoiceSum: z.number().int().min(0),
  })
  .strict();

export const transactionTransformerSchema = z
  .object({
    entryType: z.nativeEnum(EntryType),
    vatId: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed').optional(),
    allocationNumber: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed').optional(),
    invoiceDate: z.string().length(8).regex(/^\d+$/, 'Only digits are allowed'),
    refGroup: z.string().length(4).optional(),
    refNumber: z.string().length(9).regex(/^\d+$/, 'Only digits are allowed').optional(),
    totalVat: z.number().int().optional(),
    invoiceSum: z.number().int().min(0),
  })
  .strict();
