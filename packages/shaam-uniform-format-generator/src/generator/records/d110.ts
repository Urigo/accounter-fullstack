import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { DocumentTypeEnum } from '../../types/index.js';
import { formatField, formatNumericField } from '../index.js';

/**
 * D110 Record Schema - Document Line record
 * Fields 1250-1275 based on SHAAM 1.31 specification table
 */
export const D110Schema = z.object({
  // Field 1250: Record code (4) - Required - Alphanumeric
  code: z.literal('D110').describe('Record type code - always "D110"'),
  // Field 1251: Record number in file (9) - Required - Numeric
  recordNumber: z.string().min(1).max(9).regex(/^\d+$/).describe('Sequential record number'),
  // Field 1252: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1253: Document type (3) - Required - Numeric
  documentType: DocumentTypeEnum.describe('Document type - see Appendix 1'),
  // Field 1254: Document number (20) - Required - Alphanumeric
  documentNumber: z.string().min(1).max(20).describe('Document number'),
  // Field 1255: Line number in document (4) - Required - Numeric
  lineNumber: z.string().min(1).max(4).regex(/^\d+$/).describe('Line number in document'),
  // Field 1256: Base document type (3) - Conditional - Numeric
  baseDocumentType: z
    .string()
    .max(3)
    .regex(/^(\d{1,3}|)$/)
    .default('')
    .transform(val => (val === '' ? val : (val as z.infer<typeof DocumentTypeEnum>)))
    .describe('Base document type - required if based on another document'),
  // Field 1257: Base document number (20) - Conditional - Alphanumeric
  baseDocumentNumber: z
    .string()
    .max(20)
    .default('')
    .describe('Base document number - required if based on another document'),
  // Field 1258: Transaction type (1) - Optional - Numeric
  transactionType: z
    .string()
    .max(1)
    .regex(/^([123]|)$/)
    .default('')
    .describe('Transaction type: 1-Service; 2-Goods; 3-Service & Goods'),
  // Field 1259: Internal catalog code (20) - Optional - Alphanumeric
  internalCatalogCode: z.string().max(20).default('').describe('Internal catalog code'),
  // Field 1260: Goods/Service description (30) - Required - Alphanumeric
  goodsServiceDescription: z.string().min(1).max(30).describe('Goods or service description'),
  // Field 1261: Manufacturer name (50) - Optional - Alphanumeric
  manufacturerName: z
    .string()
    .max(50)
    .default('')
    .describe('Manufacturer name - relevant for goods listed in Appendix G'),
  // Field 1262: Serial number (30) - Optional - Alphanumeric
  serialNumber: z
    .string()
    .max(30)
    .default('')
    .describe('Serial number - relevant for goods listed in Appendix G'),
  // Field 1263: Unit of measure description (20) - Optional - Alphanumeric
  unitOfMeasureDescription: z
    .string()
    .max(20)
    .default('')
    .describe('Unit of measure description - use descriptive name or יחידה'),
  // Field 1264: Quantity (17) - Required - Alphanumeric with decimal format X9(12)V9999
  quantity: z.string().min(1).max(17).describe('Quantity'),
  // Field 1265: Unit price excluding VAT (15) - Optional - Alphanumeric with decimal format X9(12)V99
  unitPriceExcludingVat: z.string().max(15).default('').describe('Unit price excluding VAT in NIS'),
  // Field 1266: Line discount (15) - Optional - Alphanumeric with decimal format X9(12)V99
  lineDiscount: z.string().max(15).default('').describe('Line discount in NIS'),
  // Field 1267: Line total (15) - Optional - Alphanumeric with decimal format X9(12)V99
  lineTotal: z
    .string()
    .max(15)
    .default('')
    .describe('Line total: quantity * unit price - discount'),
  // Field 1268: VAT rate percentage (4) - Optional - Numeric with decimal format V99(2)
  vatRatePercent: z
    .string()
    .max(4)
    .regex(/^(\d{1,4}|)$/)
    .default('')
    .describe('VAT rate percentage'),
  // Field 1269: Reserved field (0) - Deprecated - Alphanumeric
  reserved1: z.string().max(0).default('').describe('Reserved field - deprecated'),
  // Field 1270: Branch ID (7) - Required - Alphanumeric
  branchId: z.string().min(1).max(7).describe('Branch ID - required if field 1034 = 1'),
  // Field 1271: Reserved field (0) - Deprecated - Alphanumeric
  reserved2: z.string().max(0).default('').describe('Reserved field - deprecated'),
  // Field 1272: Document date (8) - Required - Numeric YYYYMMDD format
  documentDate: z
    .string()
    .min(1)
    .max(8)
    .regex(/^\d{8}$/)
    .describe('Document date in YYYYMMDD format'),
  // Field 1273: Header link field (7) - Optional - Numeric
  headerLinkField: z
    .string()
    .max(7)
    .regex(/^(\d{1,7}|)$/)
    .default('')
    .describe('Header link field - link to C100'),
  // Field 1274: Base document branch ID (7) - Optional - Alphanumeric
  baseDocumentBranchId: z
    .string()
    .max(7)
    .default('')
    .describe('Base document branch ID - if field 1034 = 1'),
  // Field 1275: Reserved field (21) - Optional - Alphanumeric
  reserved3: z.string().max(21).default('').describe('Reserved field'),
});

export type D110 = z.infer<typeof D110Schema>;

/**
 * Encodes a D110 record to fixed-width string format
 * Total line width: 339 characters + CRLF
 */
export function encodeD110(input: D110): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1250: Record code (4) - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Field 1251: Record number (9) - Numeric
    formatNumericField(input.vatId, 9), // Field 1252: VAT ID (9) - Numeric
    formatNumericField(input.documentType, 3), // Field 1253: Document type (3) - Numeric
    formatField(input.documentNumber, 20, 'left'), // Field 1254: Document number (20) - Alphanumeric
    formatNumericField(input.lineNumber, 4), // Field 1255: Line number (4) - Numeric
    formatNumericField(input.baseDocumentType, 3), // Field 1256: Base document type (3) - Numeric
    formatField(input.baseDocumentNumber, 20, 'left'), // Field 1257: Base document number (20) - Alphanumeric
    formatNumericField(input.transactionType, 1), // Field 1258: Transaction type (1) - Numeric
    formatField(input.internalCatalogCode, 20, 'left'), // Field 1259: Internal catalog code (20) - Alphanumeric
    formatField(input.goodsServiceDescription, 30, 'left'), // Field 1260: Goods/Service description (30) - Alphanumeric
    formatField(input.manufacturerName, 50, 'left'), // Field 1261: Manufacturer name (50) - Alphanumeric
    formatField(input.serialNumber, 30, 'left'), // Field 1262: Serial number (30) - Alphanumeric
    formatField(input.unitOfMeasureDescription, 20, 'left'), // Field 1263: Unit of measure description (20) - Alphanumeric
    formatField(input.quantity, 17, 'left'), // Field 1264: Quantity (17) - Alphanumeric but monetary format
    formatField(input.unitPriceExcludingVat, 15, 'left'), // Field 1265: Unit price excluding VAT (15) - Alphanumeric but monetary format
    formatField(input.lineDiscount, 15, 'left'), // Field 1266: Line discount (15) - Alphanumeric but monetary format
    formatField(input.lineTotal, 15, 'left'), // Field 1267: Line total (15) - Alphanumeric but monetary format
    formatNumericField(input.vatRatePercent, 4), // Field 1268: VAT rate % (4) - Numeric with decimal
    formatField(input.reserved1, 0, 'left'), // Field 1269: Reserved (0) - Deprecated
    formatField(input.branchId, 7, 'left'), // Field 1270: Branch ID (7) - Alphanumeric
    formatField(input.reserved2, 0, 'left'), // Field 1271: Reserved (0) - Deprecated
    formatNumericField(input.documentDate, 8), // Field 1272: Document date (8) - Numeric YYYYMMDD
    formatNumericField(input.headerLinkField, 7), // Field 1273: Header link field (7) - Numeric
    formatField(input.baseDocumentBranchId, 7, 'left'), // Field 1274: Base document branch ID (7) - Alphanumeric
    formatField(input.reserved3, 21, 'left'), // Field 1275: Reserved (21) - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width D110 record line back to object
 * Expected line length: 339 characters (excluding CRLF)
 */
export function parseD110(line: string): D110 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 339) {
    throw new Error(`Invalid D110 record length: expected 339 characters, got ${cleanLine.length}`);
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
  const documentType = (cleanLine
    .slice(pos, pos + 3)
    .trim()
    .replace(/^0+/, '') || '0') as z.infer<typeof DocumentTypeEnum>;
  pos += 3;
  const documentNumber = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const lineNumber =
    cleanLine
      .slice(pos, pos + 4)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 4;
  const baseDocumentType = cleanLine.slice(pos, pos + 3).trim() as
    | ''
    | z.infer<typeof DocumentTypeEnum>;
  pos += 3;
  const baseDocumentNumber = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const transactionType = cleanLine.slice(pos, pos + 1).trim();
  const processedTransactionType = transactionType === '0' ? '' : transactionType;
  pos += 1;
  const internalCatalogCode = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const goodsServiceDescription = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const manufacturerName = cleanLine.slice(pos, pos + 50).trim();
  pos += 50;
  const serialNumber = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const unitOfMeasureDescription = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const quantity = cleanLine.slice(pos, pos + 17).trim();
  pos += 17;
  const unitPriceExcludingVat = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const lineDiscount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const lineTotal = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const vatRatePercent =
    cleanLine
      .slice(pos, pos + 4)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 4;
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
      .replace(/^0+/, '') || '0';
  pos += 8;
  const headerLinkField =
    cleanLine
      .slice(pos, pos + 7)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 7;
  const baseDocumentBranchId = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const reserved3 = cleanLine.slice(pos, pos + 21).trim(); // 21 width

  // Validate the code field
  if (code !== 'D110') {
    throw new Error(`Invalid D110 record code: expected "D110", got "${code}"`);
  }

  const parsed: D110 = {
    code,
    recordNumber,
    vatId,
    documentType,
    documentNumber,
    lineNumber,
    baseDocumentType,
    baseDocumentNumber,
    transactionType: processedTransactionType,
    internalCatalogCode,
    goodsServiceDescription,
    manufacturerName,
    serialNumber,
    unitOfMeasureDescription,
    quantity,
    unitPriceExcludingVat,
    lineDiscount,
    lineTotal,
    vatRatePercent,
    reserved1,
    branchId,
    reserved2,
    documentDate,
    headerLinkField,
    baseDocumentBranchId,
    reserved3,
  };

  // Validate against schema
  return D110Schema.parse(parsed);
}
