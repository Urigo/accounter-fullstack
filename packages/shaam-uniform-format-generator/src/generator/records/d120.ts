import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../index.js';

/**
 * D120 - Payment/receipt record
 * Fields 1300-1324 based on SHAAM 1.31 specification
 */
export const D120Schema = z.object({
  // Field 1300: Record code (4) - Required - Alphanumeric - Value: D120
  code: z.literal('D120').describe('Record type code - always "D120"'),
  // Field 1301: Record number in file (9) - Required - Numeric
  recordNumber: z
    .string()
    .min(1)
    .max(9)
    .regex(/^\d+$/)
    .describe('Sequential record number in file'),
  // Field 1302: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1303: Document type (3) - Required - Numeric
  documentType: z
    .string()
    .min(1)
    .max(3)
    .regex(/^\d+$/)
    .describe('Document type - see Appendix 1, Note 1'),
  // Field 1304: Document number (20) - Required - Alphanumeric
  documentNumber: z.string().min(1).max(20).describe('Document number'),
  // Field 1305: Line number in document (4) - Required - Numeric
  lineNumber: z.string().min(1).max(4).regex(/^\d+$/).describe('Line number in document'),
  // Field 1306: Payment method (1) - Required - Numeric
  paymentMethod: z
    .string()
    .min(1)
    .max(1)
    .regex(/^[1-9]$/)
    .describe(
      'Payment method type: 1-Cash, 2-Check, 3-Credit card, 4-Bank transfer, 5-Voucher, 6-Exchange slip, 7-Promissory note, 8-Standing order, 9-Other',
    ),
  // Field 1307: Bank number (10) - Conditional - Numeric - Check only
  bankNumber: z.string().max(10).regex(/^\d*$/).default('').describe('Bank number - check only'),
  // Field 1308: Branch number (10) - Conditional - Numeric - Check only
  branchNumber: z
    .string()
    .max(10)
    .regex(/^\d*$/)
    .default('')
    .describe('Branch number - check only'),
  // Field 1309: Account number (15) - Conditional - Numeric - Check only
  accountNumber: z
    .string()
    .max(15)
    .regex(/^\d*$/)
    .default('')
    .describe('Account number - check only'),
  // Field 1310: Check number (10) - Conditional - Numeric - Check only
  checkNumber: z.string().max(10).regex(/^\d*$/).default('').describe('Check number - check only'),
  // Field 1311: Payment due date (8) - Optional - Numeric - Format YYYYMMDD
  paymentDueDate: z
    .string()
    .max(8)
    .regex(/^(\d{8}|)$/)
    .default('')
    .describe('Payment due date YYYYMMDD - check or credit card only'),
  // Field 1312: Line amount (15) - Required - Alphanumeric - Format X9(12)V99
  lineAmount: z
    .string()
    .min(1)
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .describe('Line amount'),
  // Field 1313: Acquirer code (1) - Optional - Numeric
  acquirerCode: z
    .string()
    .max(1)
    .regex(/^[1-6]?$/)
    .default('')
    .describe('Acquirer code: 1-Isracard, 2-Cal, 3-Diners, 4-Amex, 6-Leumi Card'),
  // Field 1314: Card brand (20) - Optional - Alphanumeric
  cardBrand: z.string().max(20).default('').describe('Card brand name'),
  // Field 1315: Credit transaction type (1) - Optional - Numeric
  creditTransactionType: z
    .string()
    .max(1)
    .regex(/^[1-5]?$/)
    .default('')
    .describe('Credit transaction type: 1-Regular, 2-Installments, 3-Credit, 4-Deferred, 5-Other'),
  // Field 1316: First payment amount (0) - Deprecated - Alphanumeric
  firstPaymentAmount: z.string().max(0).default('').describe('First payment amount (deprecated)'),
  // Field 1317: Installments count (0) - Deprecated - Alphanumeric
  installmentsCount: z.string().max(0).default('').describe('Installments count (deprecated)'),
  // Field 1318: Additional payment amount (0) - Deprecated - Alphanumeric
  additionalPaymentAmount: z
    .string()
    .max(0)
    .default('')
    .describe('Additional payment amount (deprecated)'),
  // Field 1319: Reserved field (0) - Deprecated - Alphanumeric
  reserved1: z.string().max(0).default('').describe('Reserved field 1 (deprecated)'),
  // Field 1320: Branch ID (7) - Required - Alphanumeric - Required if field 1034 = 1
  branchId: z
    .string()
    .max(7)
    .default('')
    .describe('Branch/sector ID - required if field 1034 = 1, see Note 3'),
  // Field 1321: Reserved field (0) - Deprecated - Alphanumeric
  reserved2: z.string().max(0).default('').describe('Reserved field 2 (deprecated)'),
  // Field 1322: Document date (8) - Required - Numeric - Format YYYYMMDD
  documentDate: z
    .string()
    .min(1)
    .max(8)
    .regex(/^\d{8}$/)
    .describe('Document date YYYYMMDD - see Note 12'),
  // Field 1323: Header link field (7) - Optional - Numeric - For linking to C100
  headerLinkField: z
    .string()
    .max(7)
    .regex(/^\d*$/)
    .default('')
    .describe('Header connecting field - for linking to C100, see Note 11'),
  // Field 1324: Reserved field (60) - Optional - Alphanumeric
  reserved: z.string().max(60).default('').describe('Reserved field for future use'),
});

export type D120 = z.infer<typeof D120Schema>;

/**
 * Encodes a D120 record to fixed-width string format
 * Total line width: 222 characters + CRLF (4+9+9+3+20+4+1+10+10+15+10+8+15+1+20+1+0+0+0+0+7+0+8+7+60)
 */
export function encodeD120(input: D120): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1300: Record code (4) - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Field 1301: Record number (9) - Numeric, zero-padded
    formatNumericField(input.vatId, 9), // Field 1302: VAT ID (9) - Numeric, zero-padded
    formatNumericField(input.documentType, 3), // Field 1303: Document type (3) - Numeric, zero-padded
    formatField(input.documentNumber, 20, 'left'), // Field 1304: Document number (20) - Alphanumeric
    formatNumericField(input.lineNumber, 4), // Field 1305: Line number (4) - Numeric, zero-padded
    formatNumericField(input.paymentMethod, 1), // Field 1306: Payment method (1) - Numeric, zero-padded
    formatField(input.bankNumber, 10, 'left'), // Field 1307: Bank number (10) - Conditional, space-padded when empty
    formatField(input.branchNumber, 10, 'left'), // Field 1308: Branch number (10) - Conditional, space-padded when empty
    formatField(input.accountNumber, 15, 'left'), // Field 1309: Account number (15) - Conditional, space-padded when empty
    formatField(input.checkNumber, 10, 'left'), // Field 1310: Check number (10) - Conditional, space-padded when empty
    formatField(input.paymentDueDate, 8, 'left'), // Field 1311: Payment due date (8) - Optional date field, space-padded when empty
    formatField(input.lineAmount, 15, 'left'), // Field 1312: Line amount (15) - Alphanumeric monetary format
    formatField(input.acquirerCode, 1, 'left'), // Field 1313: Acquirer code (1) - Optional, space-padded when empty
    formatField(input.cardBrand, 20, 'left'), // Field 1314: Card brand (20) - Alphanumeric
    formatField(input.creditTransactionType, 1, 'left'), // Field 1315: Credit transaction type (1) - Optional, space-padded when empty
    formatField(input.firstPaymentAmount, 0, 'left'), // Field 1316: First payment amount (0) - Deprecated
    formatField(input.installmentsCount, 0, 'left'), // Field 1317: Installments count (0) - Deprecated
    formatField(input.additionalPaymentAmount, 0, 'left'), // Field 1318: Additional payment amount (0) - Deprecated
    formatField(input.reserved1, 0, 'left'), // Field 1319: Reserved 1 (0) - Deprecated
    formatField(input.branchId, 7, 'left'), // Field 1320: Branch ID (7) - Alphanumeric
    formatField(input.reserved2, 0, 'left'), // Field 1321: Reserved 2 (0) - Deprecated
    formatNumericField(input.documentDate, 8), // Field 1322: Document date (8) - Numeric, zero-padded
    formatField(input.headerLinkField, 7, 'left'), // Field 1323: Header link field (7) - Optional, space-padded when empty
    formatField(input.reserved, 60, 'left'), // Field 1324: Reserved (60) - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width D120 record line back to object
 * Expected line length: 222 characters (excluding CRLF)
 */
export function parseD120(line: string): D120 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 222) {
    throw new Error(`Invalid D120 record length: expected 222 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions
  let pos = 0;
  const code = cleanLine.slice(pos, pos + 4).trim();
  pos += 4;
  const recordNumber =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '0'; // Strip leading zeros
  pos += 9;
  const vatId =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '0'; // Strip leading zeros
  pos += 9;
  const documentType =
    cleanLine
      .slice(pos, pos + 3)
      .trim()
      .replace(/^0+/, '') || '0'; // Strip leading zeros
  pos += 3;
  const documentNumber = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const lineNumber =
    cleanLine
      .slice(pos, pos + 4)
      .trim()
      .replace(/^0+/, '') || '0'; // Strip leading zeros
  pos += 4;
  const paymentMethod =
    cleanLine
      .slice(pos, pos + 1)
      .trim()
      .replace(/^0+/, '') || '0'; // Strip leading zeros
  pos += 1;
  const bankNumber = cleanLine.slice(pos, pos + 10).trim();
  const bankNumberProcessed = bankNumber === '' ? '' : bankNumber.replace(/^0+/, '') || '0'; // Strip leading zeros only if not empty
  pos += 10;
  const branchNumber = cleanLine.slice(pos, pos + 10).trim();
  const branchNumberProcessed = branchNumber === '' ? '' : branchNumber.replace(/^0+/, '') || '0'; // Strip leading zeros only if not empty
  pos += 10;
  const accountNumber = cleanLine.slice(pos, pos + 15).trim();
  const accountNumberProcessed =
    accountNumber === '' ? '' : accountNumber.replace(/^0+/, '') || '0'; // Strip leading zeros only if not empty
  pos += 15;
  const checkNumber = cleanLine.slice(pos, pos + 10).trim();
  const checkNumberProcessed = checkNumber === '' ? '' : checkNumber.replace(/^0+/, '') || '0'; // Strip leading zeros only if not empty
  pos += 10;
  const paymentDueDate = cleanLine.slice(pos, pos + 8).trim();
  const paymentDueDateProcessed = paymentDueDate; // Keep as-is since it's a date field or empty
  pos += 8;
  const lineAmount = cleanLine.slice(pos, pos + 15).trim(); // Alphanumeric monetary format
  pos += 15;
  const acquirerCode = cleanLine.slice(pos, pos + 1).trim();
  const acquirerCodeProcessed = acquirerCode; // Keep as-is since it's a single digit field or empty
  pos += 1;
  const cardBrand = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const creditTransactionType = cleanLine.slice(pos, pos + 1).trim();
  const creditTransactionTypeProcessed = creditTransactionType; // Keep as-is since it's a single digit field or empty
  pos += 1;
  const firstPaymentAmount = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const installmentsCount = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const additionalPaymentAmount = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const reserved1 = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const branchId = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const reserved2 = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const documentDate =
    cleanLine
      .slice(pos, pos + 8)
      .trim()
      .replace(/^0+/, '') || '0'; // Strip leading zeros
  pos += 8;
  const headerLinkField = cleanLine.slice(pos, pos + 7).trim();
  const headerLinkFieldProcessed =
    headerLinkField === '' ? '' : headerLinkField.replace(/^0+/, '') || '0'; // Strip leading zeros only if not empty
  pos += 7;
  const reserved = cleanLine.slice(pos, pos + 60).trim();

  // Validate the code field
  if (code !== 'D120') {
    throw new Error(`Invalid D120 record code: expected "D120", got "${code}"`);
  }

  const parsed: D120 = {
    code,
    recordNumber,
    vatId,
    documentType,
    documentNumber,
    lineNumber,
    paymentMethod,
    bankNumber: bankNumberProcessed,
    branchNumber: branchNumberProcessed,
    accountNumber: accountNumberProcessed,
    checkNumber: checkNumberProcessed,
    paymentDueDate: paymentDueDateProcessed,
    lineAmount,
    acquirerCode: acquirerCodeProcessed,
    cardBrand,
    creditTransactionType: creditTransactionTypeProcessed,
    firstPaymentAmount,
    installmentsCount,
    additionalPaymentAmount,
    reserved1,
    branchId,
    reserved2,
    documentDate,
    headerLinkField: headerLinkFieldProcessed,
    reserved,
  };

  // Validate against schema
  return D120Schema.parse(parsed);
}
