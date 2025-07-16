import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { DocumentTypeEnum } from '../../types/index.js';
import { formatField, formatNumericField } from '../index.js';

/**
 * B100 Record Schema - Journal entry line record
 * Fields 1350-1377 based on SHAAM 1.31 specification table
 */
export const B100Schema = z.object({
  // Field 1350: Record code (4) - Required - Alphanumeric
  code: z.literal('B100').describe('Record type code - always "B100"'),
  // Field 1351: Record number in file (9) - Required - Numeric
  recordNumber: z
    .string()
    .min(1)
    .max(9)
    .regex(/^\d+$/)
    .describe('Sequential record number in file'),
  // Field 1352: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('Tax identification number'),
  // Field 1353: Transaction number (10) - Required - Numeric
  transactionNumber: z
    .string()
    .min(1)
    .max(10)
    .regex(/^\d+$/)
    .describe('Transaction number - see Note 7'),
  // Field 1354: Transaction line number (5) - Required - Numeric
  transactionLineNumber: z
    .string()
    .min(1)
    .max(5)
    .regex(/^\d+$/)
    .describe('Transaction line number'),
  // Field 1355: Batch number (8) - Optional - Numeric
  batchNumber: z
    .string()
    .max(8)
    .regex(/^$|^\d+$/)
    .default('')
    .describe('Batch number'),
  // Field 1356: Transaction type (15) - Optional - Alphanumeric
  transactionType: z.string().max(15).default('').describe('Transaction type'),
  // Field 1357: Reference document (20) - Optional - Alphanumeric
  referenceDocument: z.string().max(20).default('').describe('Reference document'),
  // Field 1358: Reference document type (3) - Optional - Numeric
  referenceDocumentType: z
    .string()
    .max(3)
    .regex(/^$|^\d+$/)
    .default('')
    .transform(val => (val === '' ? val : (val as z.infer<typeof DocumentTypeEnum>)))
    .describe('Reference document type - see Appendix 1'),
  // Field 1359: Reference document 2 (20) - Optional - Alphanumeric
  referenceDocument2: z.string().max(20).default('').describe('Reference document 2'),
  // Field 1360: Reference document type 2 (3) - Optional - Numeric
  referenceDocumentType2: z
    .string()
    .max(3)
    .regex(/^$|^\d+$/)
    .default('')
    .transform(val => (val === '' ? val : (val as z.infer<typeof DocumentTypeEnum>)))
    .describe('Reference document type 2 - see Appendix 1'),
  // Field 1361: Details (50) - Optional - Alphanumeric
  details: z.string().max(50).default('').describe('Details'),
  // Field 1362: Date (8) - Required - Numeric - Format: YYYYMMDD
  date: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Date in YYYYMMDD format - see Note 12'),
  // Field 1363: Value date (8) - Required - Numeric - Format: YYYYMMDD
  valueDate: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Value date in YYYYMMDD format - see Note 12'),
  // Field 1364: Account key (15) - Required - Alphanumeric
  accountKey: z.string().min(1).max(15).describe('Account key - must match B110'),
  // Field 1365: Counter account key (15) - Optional - Alphanumeric
  counterAccountKey: z
    .string()
    .max(15)
    .default('')
    .describe('Counter account key - required in single-entry bookkeeping'),
  // Field 1366: Debit/Credit indicator (1) - Required - Numeric
  debitCreditIndicator: z
    .enum(['1', '2'])
    .describe('Debit/Credit indicator: 1 = Debit, 2 = Credit'),
  // Field 1367: Currency code (3) - Optional - Alphanumeric
  currencyCode: z
    .string()
    .max(3)
    .default('')
    .describe('Currency code - refers to field 1369; see Appendix 2'),
  // Field 1368: Transaction amount (15) - Required - Alphanumeric - Format: X9(12)V99
  transactionAmount: z.string().min(1).max(15).describe('Transaction amount in local currency'),
  // Field 1369: Foreign currency amount (15) - Optional - Alphanumeric - Format: X9(12)V99
  foreignCurrencyAmount: z
    .string()
    .max(15)
    .default('')
    .describe('Transaction amount in foreign currency'),
  // Field 1370: Quantity field (12) - Optional - Alphanumeric - Format: X9(9)V99
  quantityField: z
    .string()
    .max(12)
    .default('')
    .describe('Quantity field, e.g. quantity or cost code'),
  // Field 1371: Matching field 1 (10) - Optional - Alphanumeric
  matchingField1: z
    .string()
    .max(10)
    .default('')
    .describe('Matching field 1 - used for internal row reconciliation'),
  // Field 1372: Matching field 2 (10) - Optional - Alphanumeric
  matchingField2: z
    .string()
    .max(10)
    .default('')
    .describe('Matching field 2 - used for inter-card or external reconciliation'),
  // Field 1373: Reserved field (0) - Deprecated - Alphanumeric
  // Skipped as it has 0 length
  // Field 1374: Branch ID (7) - Conditional - Alphanumeric
  branchId: z
    .string()
    .max(7)
    .default('')
    .describe('Branch ID - conditional if field 1034 = 1; see Note 3'),
  // Field 1375: Entry date (8) - Required - Numeric - Format: YYYYMMDD
  entryDate: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Entry date in YYYYMMDD format - see Note 12'),
  // Field 1376: Operator username (9) - Optional - Alphanumeric
  operatorUsername: z.string().max(9).default('').describe('Operator username'),
  // Field 1377: Reserved field (25) - Optional - Alphanumeric
  reserved: z.string().max(25).default('').describe('Reserved field for future use'),
});

export type B100 = z.infer<typeof B100Schema>;

/**
 * Encodes a B100 record to fixed-width string format
 * Total line width: 317 characters + CRLF
 */
export function encodeB100(input: B100): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1350: Record code (4)
    formatNumericField(input.recordNumber, 9), // Field 1351: Record number (9)
    formatNumericField(input.vatId, 9), // Field 1352: VAT ID (9)
    formatNumericField(input.transactionNumber, 10), // Field 1353: Transaction number (10)
    formatNumericField(input.transactionLineNumber, 5), // Field 1354: Transaction line number (5)
    formatNumericField(input.batchNumber, 8), // Field 1355: Batch number (8)
    formatField(input.transactionType, 15, 'left'), // Field 1356: Transaction type (15)
    formatField(input.referenceDocument, 20, 'left'), // Field 1357: Reference document (20)
    formatNumericField(input.referenceDocumentType, 3), // Field 1358: Reference document type (3)
    formatField(input.referenceDocument2, 20, 'left'), // Field 1359: Reference document 2 (20)
    formatNumericField(input.referenceDocumentType2, 3), // Field 1360: Reference document type 2 (3)
    formatField(input.details, 50, 'left'), // Field 1361: Details (50)
    formatField(input.date, 8, 'left'), // Field 1362: Date (8)
    formatField(input.valueDate, 8, 'left'), // Field 1363: Value date (8)
    formatField(input.accountKey, 15, 'left'), // Field 1364: Account key (15)
    formatField(input.counterAccountKey, 15, 'left'), // Field 1365: Counter account key (15)
    formatField(input.debitCreditIndicator, 1, 'left'), // Field 1366: Debit/Credit indicator (1)
    formatField(input.currencyCode, 3, 'left'), // Field 1367: Currency code (3)
    formatField(input.transactionAmount, 15, 'right'), // Field 1368: Transaction amount (15) - right-aligned for amount
    formatField(input.foreignCurrencyAmount, 15, 'right'), // Field 1369: Foreign currency amount (15) - right-aligned for amount
    formatField(input.quantityField, 12, 'right'), // Field 1370: Quantity field (12) - right-aligned for numeric
    formatField(input.matchingField1, 10, 'left'), // Field 1371: Matching field 1 (10)
    formatField(input.matchingField2, 10, 'left'), // Field 1372: Matching field 2 (10)
    // Field 1373: Reserved field (0) - skipped as it has 0 length
    formatField(input.branchId, 7, 'left'), // Field 1374: Branch ID (7)
    formatField(input.entryDate, 8, 'left'), // Field 1375: Entry date (8)
    formatField(input.operatorUsername, 9, 'left'), // Field 1376: Operator username (9)
    formatField(input.reserved, 25, 'left'), // Field 1377: Reserved field (25)
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width B100 record line back to object
 * Expected line length: 317 characters (excluding CRLF)
 */
export function parseB100(line: string): B100 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 317) {
    throw new Error(`Invalid B100 record length: expected 317 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions
  let pos = 0;
  const code = cleanLine.slice(pos, pos + 4).trim();
  pos += 4;
  const recordNumber =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 9;
  const vatId =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 9;
  const transactionNumber =
    cleanLine
      .slice(pos, pos + 10)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 10;
  const transactionLineNumber =
    cleanLine
      .slice(pos, pos + 5)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 5;
  const batchNumber =
    cleanLine
      .slice(pos, pos + 8)
      .trim()
      .replace(/^0+/, '') || '';
  pos += 8;
  const transactionType = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const referenceDocument = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const referenceDocumentType = (cleanLine
    .slice(pos, pos + 3)
    .trim()
    .replace(/^0+/, '') || '') as '' | z.infer<typeof DocumentTypeEnum>;
  pos += 3;
  const referenceDocument2 = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const referenceDocumentType2 = (cleanLine
    .slice(pos, pos + 3)
    .trim()
    .replace(/^0+/, '') || '') as '' | z.infer<typeof DocumentTypeEnum>;
  pos += 3;
  const details = cleanLine.slice(pos, pos + 50).trim();
  pos += 50;
  const date = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const valueDate = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const accountKey = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const counterAccountKey = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const debitCreditIndicator = cleanLine.slice(pos, pos + 1).trim();
  pos += 1;
  const currencyCode = cleanLine.slice(pos, pos + 3).trim();
  pos += 3;
  const transactionAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const foreignCurrencyAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const quantityField = cleanLine.slice(pos, pos + 12).trim();
  pos += 12;
  const matchingField1 = cleanLine.slice(pos, pos + 10).trim();
  pos += 10;
  const matchingField2 = cleanLine.slice(pos, pos + 10).trim();
  pos += 10;
  // Field 1373: Reserved field (0) - skipped as it has 0 length
  const branchId = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const entryDate = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const operatorUsername = cleanLine.slice(pos, pos + 9).trim();
  pos += 9;
  const reserved = cleanLine.slice(pos, pos + 25).trim();
  pos += 25;

  // Validate the code field
  if (code !== 'B100') {
    throw new Error(`Invalid B100 record code: expected "B100", got "${code}"`);
  }

  const parsed: B100 = {
    code,
    recordNumber,
    vatId,
    transactionNumber,
    transactionLineNumber,
    batchNumber,
    transactionType,
    referenceDocument,
    referenceDocumentType,
    referenceDocument2,
    referenceDocumentType2,
    details,
    date,
    valueDate,
    accountKey,
    counterAccountKey,
    debitCreditIndicator: debitCreditIndicator as '1' | '2',
    currencyCode,
    transactionAmount,
    foreignCurrencyAmount,
    quantityField,
    matchingField1,
    matchingField2,
    branchId,
    entryDate,
    operatorUsername,
    reserved,
  };

  // Validate against schema
  return B100Schema.parse(parsed);
}
