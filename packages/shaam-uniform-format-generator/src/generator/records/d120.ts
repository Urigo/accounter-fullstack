import { z } from 'zod';
import { CRLF, padLeft, padRight } from '../../format/index.js';

/**
 * Helper function to format a field with specified width and alignment
 */
function formatField(value: string, width: number, align: 'left' | 'right'): string {
  if (align === 'left') {
    return padRight(value, width);
  }
  return padLeft(value, width);
}

/**
 * D120 - Payment/receipt record
 * Fields 1300-1324 based on SHAAM 1.31 specification
 */
export const D120Schema = z.object({
  code: z.literal('D120').describe('Record type code - always "D120"'),
  recordNumber: z.string().min(1).max(9).describe('Sequential record number'),
  vatId: z.string().min(1).max(9).describe('VAT identification number'),
  documentType: z.string().max(3).default('').describe('Document type'),
  documentNumber: z.string().max(20).default('').describe('Document number'),
  lineNumber: z.string().max(4).default('').describe('Line number in document'),
  paymentMethod: z.string().max(1).default('').describe('Payment method type'),
  bankNumber: z.string().max(10).default('').describe('Bank number'),
  branchNumber: z.string().max(10).default('').describe('Branch number'),
  accountNumber: z.string().max(15).default('').describe('Account number'),
  checkNumber: z.string().max(10).default('').describe('Check number'),
  paymentDueDate: z.string().max(8).default('').describe('Payment due date YYYYMMDD'),
  lineAmount: z.string().max(15).default('').describe('Line amount'),
  acquirerCode: z.string().max(1).default('').describe('Acquirer code'),
  cardBrand: z.string().max(20).default('').describe('Card brand name'),
  creditTransactionType: z.string().max(1).default('').describe('Credit transaction type'),
  firstPaymentAmount: z.string().max(0).default('').describe('First payment amount (deprecated)'),
  installmentsCount: z.string().max(0).default('').describe('Installments count (deprecated)'),
  additionalPaymentAmount: z
    .string()
    .max(0)
    .default('')
    .describe('Additional payment amount (deprecated)'),
  reserved1: z.string().max(0).default('').describe('Reserved field 1 (deprecated)'),
  branchId: z.string().max(7).default('').describe('Branch/sector ID'),
  reserved2: z.string().max(0).default('').describe('Reserved field 2 (deprecated)'),
  documentDate: z.string().max(8).default('').describe('Document date YYYYMMDD'),
  headerLinkField: z.string().max(7).default('').describe('Header connecting field'),
  reserved: z.string().max(60).default('').describe('Reserved field for future use'),
});

export type D120 = z.infer<typeof D120Schema>;

/**
 * Encodes a D120 record to fixed-width string format
 * Total line width: 222 characters + CRLF (4+9+9+3+20+4+1+10+10+15+10+8+15+1+20+1+0+0+0+0+7+0+8+7+60)
 */
export function encodeD120(input: D120): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1300: Record code (4)
    formatField(input.recordNumber, 9, 'right'), // Field 1301: Record number (9)
    formatField(input.vatId, 9, 'left'), // Field 1302: VAT ID (9)
    formatField(input.documentType, 3, 'left'), // Field 1303: Document type (3)
    formatField(input.documentNumber, 20, 'left'), // Field 1304: Document number (20)
    formatField(input.lineNumber, 4, 'left'), // Field 1305: Line number (4)
    formatField(input.paymentMethod, 1, 'left'), // Field 1306: Payment method (1)
    formatField(input.bankNumber, 10, 'left'), // Field 1307: Bank number (10)
    formatField(input.branchNumber, 10, 'left'), // Field 1308: Branch number (10)
    formatField(input.accountNumber, 15, 'left'), // Field 1309: Account number (15)
    formatField(input.checkNumber, 10, 'left'), // Field 1310: Check number (10)
    formatField(input.paymentDueDate, 8, 'left'), // Field 1311: Payment due date (8)
    formatField(input.lineAmount, 15, 'right'), // Field 1312: Line amount (15)
    formatField(input.acquirerCode, 1, 'left'), // Field 1313: Acquirer code (1)
    formatField(input.cardBrand, 20, 'left'), // Field 1314: Card brand (20)
    formatField(input.creditTransactionType, 1, 'left'), // Field 1315: Credit transaction type (1)
    formatField(input.firstPaymentAmount, 0, 'left'), // Field 1316: First payment amount (0)
    formatField(input.installmentsCount, 0, 'left'), // Field 1317: Installments count (0)
    formatField(input.additionalPaymentAmount, 0, 'left'), // Field 1318: Additional payment amount (0)
    formatField(input.reserved1, 0, 'left'), // Field 1319: Reserved 1 (0)
    formatField(input.branchId, 7, 'left'), // Field 1320: Branch ID (7)
    formatField(input.reserved2, 0, 'left'), // Field 1321: Reserved 2 (0)
    formatField(input.documentDate, 8, 'left'), // Field 1322: Document date (8)
    formatField(input.headerLinkField, 7, 'left'), // Field 1323: Header link field (7)
    formatField(input.reserved, 60, 'left'), // Field 1324: Reserved (60)
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
  const recordNumber = cleanLine.slice(pos, pos + 9).trim();
  pos += 9;
  const vatId = cleanLine.slice(pos, pos + 9).trim();
  pos += 9;
  const documentType = cleanLine.slice(pos, pos + 3).trim();
  pos += 3;
  const documentNumber = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const lineNumber = cleanLine.slice(pos, pos + 4).trim();
  pos += 4;
  const paymentMethod = cleanLine.slice(pos, pos + 1).trim();
  pos += 1;
  const bankNumber = cleanLine.slice(pos, pos + 10).trim();
  pos += 10;
  const branchNumber = cleanLine.slice(pos, pos + 10).trim();
  pos += 10;
  const accountNumber = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const checkNumber = cleanLine.slice(pos, pos + 10).trim();
  pos += 10;
  const paymentDueDate = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const lineAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const acquirerCode = cleanLine.slice(pos, pos + 1).trim();
  pos += 1;
  const cardBrand = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const creditTransactionType = cleanLine.slice(pos, pos + 1).trim();
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
  const documentDate = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const headerLinkField = cleanLine.slice(pos, pos + 7).trim();
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
    bankNumber,
    branchNumber,
    accountNumber,
    checkNumber,
    paymentDueDate,
    lineAmount,
    acquirerCode,
    cardBrand,
    creditTransactionType,
    firstPaymentAmount,
    installmentsCount,
    additionalPaymentAmount,
    reserved1,
    branchId,
    reserved2,
    documentDate,
    headerLinkField,
    reserved,
  };

  // Validate against schema
  return D120Schema.parse(parsed);
}
