import { z } from 'zod';
import { CRLF, padLeft, padRight } from '../../format/index.js';

/**
 * Helper function to format a field with specified width and alignment
 */
function formatField(value: string | undefined, width: number, align: 'left' | 'right'): string {
  const safeValue = value || '';
  if (align === 'left') {
    return padRight(safeValue, width);
  }
  return padLeft(safeValue, width);
}

/**
 * D110 Record Schema - Document Line record
 * Fields 1250-1275 based on SHAAM 1.31 specification table
 */
export const D110Schema = z.object({
  code: z.literal('D110').describe('Record type code - always "D110"'),
  recordNumber: z.string().min(1).max(9).describe('Sequential record number'),
  vatId: z.string().min(1).max(9).describe('VAT identification number'),
  documentType: z.string().max(3).default('').describe('Document type'),
  documentNumber: z.string().max(20).default('').describe('Document number'),
  rowNumberInDocument: z.string().max(4).default('').describe('Row number in document'),
  baseDocumentType: z.string().max(3).default('').describe('Base document type'),
  baseDocumentNumber: z.string().max(20).default('').describe('Base document number'),
  dealType: z.string().max(1).default('').describe('Deal type'),
  internalKey: z.string().max(20).default('').describe('Internal key'),
  soldGoodsOrServiceDescription: z
    .string()
    .max(30)
    .default('')
    .describe('Sold goods or provided service description'),
  producerName: z.string().max(50).default('').describe('Producer name'),
  producerPackagePrintedSerial: z
    .string()
    .max(30)
    .default('')
    .describe('Producer package-printed serial'),
  unitOfMeasure: z.string().max(20).default('').describe('Unit of measure'),
  quantity: z.string().max(17).default('').describe('Quantity'),
  unitAmountExcludingVat: z.string().max(15).default('').describe('Unit amount excluding VAT'),
  lineDiscountAmount: z.string().max(15).default('').describe('Line discount amount'),
  totalLineAmount: z.string().max(15).default('').describe('Total line amount'),
  lineVatAmount: z.string().max(4).default('').describe('Line VAT amount'),
  reserved1: z.string().max(0).default('').describe('Reserved 1 [cancelled] (0 width field)'),
  branchOrSectorId: z.string().max(7).default('').describe('Branch or sector ID'),
  reserved2: z.string().max(0).default('').describe('Reserved 2 [cancelled] (0 width field)'),
  documentDate: z.string().max(8).default('').describe('Document date YYYYMMDD'),
  headerConnectingField: z.string().max(7).default('').describe('Header connecting field'),
  baseDocumentBranchOrSectorId: z
    .string()
    .max(7)
    .default('')
    .describe('Base document branch or sector ID'),
  reserved: z.string().max(21).default('').describe('Reserved field'),
});

export type D110 = z.infer<typeof D110Schema>;

/**
 * Encodes a D110 record to fixed-width string format
 * Total line width: 339 characters + CRLF (4+9+9+3+20+4+3+20+1+20+30+50+30+20+17+15+15+15+4+0+7+0+8+7+7+21)
 */
export function encodeD110(input: D110): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1250: Record code (4)
    formatField(input.recordNumber, 9, 'right'), // Field 1251: Record number (9)
    formatField(input.vatId, 9, 'left'), // Field 1252: VAT ID (9)
    formatField(input.documentType, 3, 'left'), // Field 1253: Document type (3)
    formatField(input.documentNumber, 20, 'left'), // Field 1254: Document number (20)
    formatField(input.rowNumberInDocument, 4, 'left'), // Field 1255: Row number in document (4)
    formatField(input.baseDocumentType, 3, 'left'), // Field 1256: Base document type (3)
    formatField(input.baseDocumentNumber, 20, 'left'), // Field 1257: Base document number (20)
    formatField(input.dealType, 1, 'left'), // Field 1258: Deal type (1)
    formatField(input.internalKey, 20, 'left'), // Field 1259: Internal key (20)
    formatField(input.soldGoodsOrServiceDescription, 30, 'left'), // Field 1260: Description (30)
    formatField(input.producerName, 50, 'left'), // Field 1261: Producer name (50)
    formatField(input.producerPackagePrintedSerial, 30, 'left'), // Field 1262: Producer serial (30)
    formatField(input.unitOfMeasure, 20, 'left'), // Field 1263: Unit of measure (20)
    formatField(input.quantity, 17, 'right'), // Field 1264: Quantity (17)
    formatField(input.unitAmountExcludingVat, 15, 'right'), // Field 1265: Unit amount excluding VAT (15)
    formatField(input.lineDiscountAmount, 15, 'right'), // Field 1266: Line discount amount (15)
    formatField(input.totalLineAmount, 15, 'right'), // Field 1267: Total line amount (15)
    formatField(input.lineVatAmount, 4, 'right'), // Field 1268: Line VAT amount (4)
    formatField(input.reserved1, 0, 'left'), // Field 1269: Reserved 1 [cancelled] (0)
    formatField(input.branchOrSectorId, 7, 'left'), // Field 1270: Branch or sector ID (7)
    formatField(input.reserved2, 0, 'left'), // Field 1271: Reserved 2 [cancelled] (0)
    formatField(input.documentDate, 8, 'left'), // Field 1272: Document date (8)
    formatField(input.headerConnectingField, 7, 'left'), // Field 1273: Header connecting field (7)
    formatField(input.baseDocumentBranchOrSectorId, 7, 'left'), // Field 1274: Base document branch/sector ID (7)
    formatField(input.reserved, 21, 'left'), // Field 1275: Reserved (21)
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
  const recordNumber = cleanLine.slice(pos, pos + 9).trim();
  pos += 9;
  const vatId = cleanLine.slice(pos, pos + 9).trim();
  pos += 9;
  const documentType = cleanLine.slice(pos, pos + 3).trim();
  pos += 3;
  const documentNumber = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const rowNumberInDocument = cleanLine.slice(pos, pos + 4).trim();
  pos += 4;
  const baseDocumentType = cleanLine.slice(pos, pos + 3).trim();
  pos += 3;
  const baseDocumentNumber = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const dealType = cleanLine.slice(pos, pos + 1).trim();
  pos += 1;
  const internalKey = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const soldGoodsOrServiceDescription = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const producerName = cleanLine.slice(pos, pos + 50).trim();
  pos += 50;
  const producerPackagePrintedSerial = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const unitOfMeasure = cleanLine.slice(pos, pos + 20).trim();
  pos += 20;
  const quantity = cleanLine.slice(pos, pos + 17).trim();
  pos += 17;
  const unitAmountExcludingVat = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const lineDiscountAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const totalLineAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const lineVatAmount = cleanLine.slice(pos, pos + 4).trim();
  pos += 4;
  const reserved1 = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const branchOrSectorId = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const reserved2 = cleanLine.slice(pos, pos + 0).trim();
  pos += 0; // 0 width
  const documentDate = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const headerConnectingField = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const baseDocumentBranchOrSectorId = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const reserved = cleanLine.slice(pos, pos + 21).trim(); // 21 width

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
    rowNumberInDocument,
    baseDocumentType,
    baseDocumentNumber,
    dealType,
    internalKey,
    soldGoodsOrServiceDescription,
    producerName,
    producerPackagePrintedSerial,
    unitOfMeasure,
    quantity,
    unitAmountExcludingVat,
    lineDiscountAmount,
    totalLineAmount,
    lineVatAmount,
    reserved1,
    branchOrSectorId,
    reserved2,
    documentDate,
    headerConnectingField,
    baseDocumentBranchOrSectorId,
    reserved,
  };

  // Validate against schema
  return D110Schema.parse(parsed);
}
