import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../index.js';

/**
 * C100 Record Schema - Document header record
 * Fields 1200-1235 based on SHAAM 1.31 specification
 * Total record length: 445 characters
 */
export const C100Schema = z.object({
  // Field 1200: Record code (4) - positions 1-4
  code: z.literal('C100').describe('Record type code - always "C100"'),
  // Field 1201: Record number in BKMVDATA.TXT file (9) - positions 5-13
  recordNumber: z.string().min(1).max(9).regex(/^\d+$/).describe('Sequential record number'),
  // Field 1202: VAT ID number without control digits (9) - positions 14-22
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1203: Document type (3) - positions 23-25
  documentType: z.string().min(1).max(3).regex(/^\d+$/).describe('Document type code'),
  // Field 1204: Document ID/sequence number (20) - positions 26-45
  documentId: z.string().min(1).max(20).describe('Document identification number'),
  // Field 1205: Document issue date YYYYMMDD format (8) - positions 46-53
  documentIssueDate: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Document issue date YYYYMMDD'),
  // Field 1206: Document issue time HHMM format in 24h (4) - positions 54-57
  documentIssueTime: z
    .string()
    .max(4)
    .regex(/^(\d{4}|)$/)
    .default('')
    .describe('Document issue time HHMM (24h format)'),
  // Field 1207: Customer/Supplier name/description (50) - positions 58-107
  customerName: z.string().max(50).default('').describe('Customer or supplier name'),
  // Field 1208: Customer/Supplier street (50) - positions 108-157
  customerStreet: z.string().max(50).default('').describe('Customer street address'),
  // Field 1209: Customer/Supplier house number (10) - positions 158-167
  customerHouseNumber: z.string().max(10).default('').describe('Customer house number'),
  // Field 1210: Customer/Supplier city (30) - positions 168-197
  customerCity: z.string().max(30).default('').describe('Customer city'),
  // Field 1211: Customer/Supplier post code (8) - positions 198-205
  customerPostCode: z.string().max(8).default('').describe('Customer post code'),
  // Field 1212: Customer/Supplier country (30) - positions 206-235
  customerCountry: z.string().max(30).default('').describe('Customer country'),
  // Field 1213: Customer/Supplier country code (2) - positions 236-237
  customerCountryCode: z.string().max(2).default('').describe('Customer country code'),
  // Field 1214: Customer/Supplier phone (15) - positions 238-252
  customerPhone: z.string().max(15).default('').describe('Customer phone number'),
  // Field 1215: Customer/Supplier VAT ID (9) - positions 253-261
  customerVatId: z
    .string()
    .max(9)
    .regex(/^(\d{1,9}|)$/)
    .default('')
    .describe('Customer VAT identification'),
  // Field 1216: Document value date (8) - positions 262-269
  documentValueDate: z
    .string()
    .max(8)
    .regex(/^(\d{8}|)$/)
    .default('')
    .describe('Document value date YYYYMMDD'),
  // Field 1217: Document foreign currency final amount (15) - positions 270-284
  foreignCurrencyAmount: z
    .string()
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .default('')
    .describe('Document foreign currency final amount'),
  // Field 1218: Currency code (3) - positions 285-287
  currencyCode: z.string().max(3).default('').describe('Currency code'),
  // Field 1219: Document amount before discount (15) - positions 288-302
  amountBeforeDiscount: z
    .string()
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .default('')
    .describe('Document amount before discount'),
  // Field 1220: Document discount (15) - positions 303-317
  documentDiscount: z
    .string()
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .default('')
    .describe('Document discount amount'),
  // Field 1221: Document amount after discount, not including VAT (15) - positions 318-332
  amountAfterDiscountExcludingVat: z
    .string()
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .default('')
    .describe('Amount after discount excluding VAT'),
  // Field 1222: VAT amount (15) - positions 333-347
  vatAmount: z
    .string()
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .default('')
    .describe('VAT amount'),
  // Field 1223: Document amount including VAT (15) - positions 348-362
  amountIncludingVat: z
    .string()
    .max(15)
    .regex(/^(\d{1,13}(\.\d{2})?|)$/)
    .default('')
    .describe('Document amount including VAT'),
  // Field 1224: Withholding tax amount (12) - positions 363-374
  withholdingTaxAmount: z
    .string()
    .max(12)
    .regex(/^(\d{1,10}(\.\d{2})?|)$/)
    .default('')
    .describe('Withholding tax amount'),
  // Field 1225: Customer key at seller or provider key at buyer (15) - positions 375-389
  customerKey: z
    .string()
    .max(15)
    .default('')
    .describe('Customer key at seller or provider key at buyer'),
  // Field 1226: Matching field (10) - positions 390-399
  matchingField: z.string().max(10).default('').describe('Matching field'),
  // Field 1227: [cancelled attribute] (8) - positions 400-407
  cancelledAttribute1: z.string().max(8).default('').describe('Cancelled attribute'),
  // Field 1228: Cancelled document (1) - positions 408-408
  cancelledDocument: z.string().max(1).default('').describe('Cancelled document flag'),
  // Field 1229: [cancelled attribute] (8) - positions 409-416
  cancelledAttribute2: z.string().max(8).default('').describe('Cancelled attribute'),
  // Field 1230: Document date (7) - positions 417-423
  documentDate: z
    .string()
    .max(7)
    .regex(/^(\d{7}|)$/)
    .default('')
    .describe('Document date'),
  // Field 1231: Branch key (8) - positions 424-431
  branchKey: z.string().max(8).default('').describe('Branch key'),
  // Field 1232: [cancelled attribute] (1) - positions 432-432
  cancelledAttribute3: z.string().max(1).default('').describe('Cancelled attribute'),
  // Field 1233: Action executor (13) - positions 433-445
  actionExecutor: z.string().max(13).default('').describe('Action executor'),
  // Field 1234: Line connecting field (unused in this record layout)
  lineConnectingField: z.string().max(0).default('').describe('Line connecting field (unused)'),
  // Field 1235: Reserved (unused in this record layout)
  reserved: z.string().max(0).default('').describe('Reserved field (unused)'),
});

export type C100 = z.infer<typeof C100Schema>;

/**
 * Encodes a C100 record to fixed-width string format
 * Total line width: 445 characters + CRLF
 */
export function encodeC100(input: C100): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1200: Record code (4) - positions 1-4 - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Field 1201: Record number (9) - positions 5-13 - Numeric
    formatNumericField(input.vatId, 9), // Field 1202: VAT ID (9) - positions 14-22 - Numeric
    formatNumericField(input.documentType, 3), // Field 1203: Document type (3) - positions 23-25 - Numeric
    formatField(input.documentId, 20, 'left'), // Field 1204: Document ID (20) - positions 26-45 - Alphanumeric
    formatNumericField(input.documentIssueDate, 8), // Field 1205: Document issue date (8) - positions 46-53 - Numeric
    formatNumericField(input.documentIssueTime, 4), // Field 1206: Document issue time (4) - positions 54-57 - Numeric
    formatField(input.customerName, 50, 'left'), // Field 1207: Customer name (50) - positions 58-107 - Alphanumeric
    formatField(input.customerStreet, 50, 'left'), // Field 1208: Customer street (50) - positions 108-157 - Alphanumeric
    formatField(input.customerHouseNumber, 10, 'left'), // Field 1209: Customer house number (10) - positions 158-167 - Alphanumeric
    formatField(input.customerCity, 30, 'left'), // Field 1210: Customer city (30) - positions 168-197 - Alphanumeric
    formatField(input.customerPostCode, 8, 'left'), // Field 1211: Customer post code (8) - positions 198-205 - Alphanumeric
    formatField(input.customerCountry, 30, 'left'), // Field 1212: Customer country (30) - positions 206-235 - Alphanumeric
    formatField(input.customerCountryCode, 2, 'left'), // Field 1213: Customer country code (2) - positions 236-237 - Alphanumeric
    formatField(input.customerPhone, 15, 'left'), // Field 1214: Customer phone (15) - positions 238-252 - Alphanumeric
    formatNumericField(input.customerVatId, 9), // Field 1215: Customer VAT ID (9) - positions 253-261 - Numeric
    formatNumericField(input.documentValueDate, 8), // Field 1216: Document value date (8) - positions 262-269 - Numeric
    formatField(input.foreignCurrencyAmount, 15, 'left'), // Field 1217: Foreign currency amount (15) - positions 270-284 - Alphanumeric
    formatField(input.currencyCode, 3, 'left'), // Field 1218: Currency code (3) - positions 285-287 - Alphanumeric
    formatField(input.amountBeforeDiscount, 15, 'left'), // Field 1219: Amount before discount (15) - positions 288-302 - Alphanumeric
    formatField(input.documentDiscount, 15, 'left'), // Field 1220: Document discount (15) - positions 303-317 - Alphanumeric
    formatField(input.amountAfterDiscountExcludingVat, 15, 'left'), // Field 1221: Amount after discount excluding VAT (15) - positions 318-332 - Alphanumeric
    formatField(input.vatAmount, 15, 'left'), // Field 1222: VAT amount (15) - positions 333-347 - Alphanumeric
    formatField(input.amountIncludingVat, 15, 'left'), // Field 1223: Amount including VAT (15) - positions 348-362 - Alphanumeric
    formatField(input.withholdingTaxAmount, 12, 'left'), // Field 1224: Withholding tax amount (12) - positions 363-374 - Alphanumeric
    formatField(input.customerKey, 15, 'left'), // Field 1225: Customer key (15) - positions 375-389 - Alphanumeric
    formatField(input.matchingField, 10, 'left'), // Field 1226: Matching field (10) - positions 390-399 - Alphanumeric
    formatField(input.cancelledAttribute1, 8, 'left'), // Field 1227: Cancelled attribute 1 (8) - positions 400-407 - Alphanumeric (deprecated)
    formatField(input.cancelledDocument, 1, 'left'), // Field 1228: Cancelled document (1) - positions 408-408 - Alphanumeric
    formatField(input.cancelledAttribute2, 8, 'left'), // Field 1229: Cancelled attribute 2 (8) - positions 409-416 - Alphanumeric (deprecated)
    formatNumericField(input.documentDate, 7), // Field 1230: Document date (7) - positions 417-423 - Numeric
    formatField(input.branchKey, 8, 'left'), // Field 1231: Branch key (8) - positions 424-431 - Alphanumeric
    formatField(input.cancelledAttribute3, 1, 'left'), // Field 1232: Cancelled attribute 3 (1) - positions 432-432 - Alphanumeric (deprecated)
    formatField(input.actionExecutor, 13, 'left'), // Field 1233: Action executor (13) - positions 433-445 - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width C100 record line back to object
 * Expected line length: 445 characters (excluding CRLF)
 */
/**
 * Parses a fixed-width C100 record line back to object
 * Expected line length: 445 characters (excluding CRLF)
 */
export function parseC100(line: string): C100 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 445) {
    throw new Error(`Invalid C100 record length: expected 445 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions based on specification
  let pos = 0;
  const code = cleanLine.slice(pos, pos + 4).trim();
  pos += 4; // positions 1-4
  const recordNumber =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 9; // positions 5-13
  const vatId =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 9; // positions 14-22
  const documentType =
    cleanLine
      .slice(pos, pos + 3)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 3; // positions 23-25
  const documentId = cleanLine.slice(pos, pos + 20).trim();
  pos += 20; // positions 26-45
  const documentIssueDate =
    cleanLine
      .slice(pos, pos + 8)
      .trim()
      .replace(/^0+/, '') || '0';
  pos += 8; // positions 46-53
  const documentIssueTime = cleanLine.slice(pos, pos + 4).trim();
  const processedDocumentIssueTime = documentIssueTime === '0000' ? '' : documentIssueTime;
  pos += 4; // positions 54-57
  const customerName = cleanLine.slice(pos, pos + 50).trim();
  pos += 50; // positions 58-107
  const customerStreet = cleanLine.slice(pos, pos + 50).trim();
  pos += 50; // positions 108-157
  const customerHouseNumber = cleanLine.slice(pos, pos + 10).trim();
  pos += 10; // positions 158-167
  const customerCity = cleanLine.slice(pos, pos + 30).trim();
  pos += 30; // positions 168-197
  const customerPostCode = cleanLine.slice(pos, pos + 8).trim();
  pos += 8; // positions 198-205
  const customerCountry = cleanLine.slice(pos, pos + 30).trim();
  pos += 30; // positions 206-235
  const customerCountryCode = cleanLine.slice(pos, pos + 2).trim();
  pos += 2; // positions 236-237
  const customerPhone = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 238-252
  const customerVatId = cleanLine.slice(pos, pos + 9).trim();
  const processedCustomerVatId = customerVatId ? customerVatId.replace(/^0+/, '') || '0' : '';
  pos += 9; // positions 253-261
  const documentValueDate = cleanLine.slice(pos, pos + 8).trim();
  const processedDocumentValueDate = documentValueDate === '00000000' ? '' : documentValueDate;
  pos += 8; // positions 262-269
  const foreignCurrencyAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 270-284
  const currencyCode = cleanLine.slice(pos, pos + 3).trim();
  pos += 3; // positions 285-287
  const amountBeforeDiscount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 288-302
  const documentDiscount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 303-317
  const amountAfterDiscountExcludingVat = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 318-332
  const vatAmount = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 333-347
  const amountIncludingVat = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 348-362
  const withholdingTaxAmount = cleanLine.slice(pos, pos + 12).trim();
  pos += 12; // positions 363-374
  const customerKey = cleanLine.slice(pos, pos + 15).trim();
  pos += 15; // positions 375-389
  const matchingField = cleanLine.slice(pos, pos + 10).trim();
  pos += 10; // positions 390-399
  const cancelledAttribute1 = cleanLine.slice(pos, pos + 8).trim();
  pos += 8; // positions 400-407
  const cancelledDocument = cleanLine.slice(pos, pos + 1).trim();
  pos += 1; // positions 408-408
  const cancelledAttribute2 = cleanLine.slice(pos, pos + 8).trim();
  pos += 8; // positions 409-416
  const documentDate = cleanLine.slice(pos, pos + 7).trim();
  const processedDocumentDate = documentDate === '0000000' ? '' : documentDate;
  pos += 7; // positions 417-423
  const branchKey = cleanLine.slice(pos, pos + 8).trim();
  pos += 8; // positions 424-431
  const cancelledAttribute3 = cleanLine.slice(pos, pos + 1).trim();
  pos += 1; // positions 432-432
  const actionExecutor = cleanLine.slice(pos, pos + 13).trim(); // positions 433-445

  // Validate the code field
  if (code !== 'C100') {
    throw new Error(`Invalid C100 record code: expected "C100", got "${code}"`);
  }

  const parsed: C100 = {
    code,
    recordNumber,
    vatId,
    documentType,
    documentId,
    documentIssueDate,
    documentIssueTime: processedDocumentIssueTime,
    customerName,
    customerStreet,
    customerHouseNumber,
    customerCity,
    customerPostCode,
    customerCountry,
    customerCountryCode,
    customerPhone,
    customerVatId: processedCustomerVatId,
    documentValueDate: processedDocumentValueDate,
    foreignCurrencyAmount,
    currencyCode,
    amountBeforeDiscount,
    documentDiscount,
    amountAfterDiscountExcludingVat,
    vatAmount,
    amountIncludingVat,
    withholdingTaxAmount,
    customerKey,
    matchingField,
    cancelledAttribute1,
    cancelledDocument,
    cancelledAttribute2,
    documentDate: processedDocumentDate,
    branchKey,
    cancelledAttribute3,
    actionExecutor,
    lineConnectingField: '',
    reserved: '',
  };

  // Validate against schema
  return C100Schema.parse(parsed);
}
