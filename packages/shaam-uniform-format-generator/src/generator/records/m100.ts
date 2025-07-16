import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../format/encoder.js';

/**
 * M100 Record Schema - Item/Product record
 * Fields 1450-1465 based on SHAAM 1.31 specification
 * Total record length: 294 characters
 */
export const M100Schema = z.object({
  // Field 1450: Record code (4) - Required - Alphanumeric - Value: M100
  code: z.literal('M100').describe('Record type code - always "M100"'),
  // Field 1451: Record number in file (9) - Required - Numeric
  recordNumber: z
    .string()
    .min(1)
    .max(9)
    .regex(/^\d+$/)
    .describe('Sequential record number in file'),
  // Field 1452: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1453: Universal Item Code (20) - Optional - Alphanumeric
  universalItemCode: z.string().max(20).default('').describe('Universal item code'),
  // Field 1454: Supplier/Manufacturer Item Code (20) - Optional - Alphanumeric
  supplierItemCode: z
    .string()
    .max(20)
    .default('')
    .describe('Supplier/manufacturer item code (used in purchase documents)'),
  // Field 1455: Internal Item Code (20) - Required - Alphanumeric
  internalItemCode: z.string().min(1).max(20).describe('Internal item code (must be unique)'),
  // Field 1456: Item Name (50) - Required - Alphanumeric
  itemName: z.string().min(1).max(50).describe('Item name'),
  // Field 1457: Classification Code (10) - Optional - Alphanumeric
  classificationCode: z.string().max(10).default('').describe('Classification code'),
  // Field 1458: Classification Description (30) - Optional - Alphanumeric
  classificationDescription: z.string().max(30).default('').describe('Classification description'),
  // Field 1459: Unit of Measure Description (20) - Optional - Alphanumeric
  unitOfMeasure: z
    .string()
    .max(20)
    .default('')
    .describe('Unit of measure description (e.g. liter, gram) or יחידה'),
  // Field 1460: Opening Stock Quantity (12) - Required - Alphanumeric (X9(9)V99)
  openingStock: z
    .string()
    .min(1)
    .max(12)
    .describe('Opening stock quantity at beginning of period (all warehouses)'),
  // Field 1461: Total Stock In (12) - Required - Alphanumeric (X9(9)V99)
  totalStockIn: z.string().min(1).max(12).describe('Total stock in (excluding opening balance)'),
  // Field 1462: Total Stock Out (12) - Required - Alphanumeric (X9(9)V99)
  totalStockOut: z.string().min(1).max(12).describe('Total stock out (excluding opening balance)'),
  // Field 1463: End-of-Period Cost (non-bonded) (8) - Optional - Numeric (V99(8))
  endPeriodCostNonBonded: z
    .string()
    .max(8)
    .default('')
    .describe('End-of-period cost (non-bonded warehouses) in NIS'),
  // Field 1464: End-of-Period Cost (bonded) (8) - Optional - Numeric (V99(8))
  endPeriodCostBonded: z
    .string()
    .max(8)
    .default('')
    .describe('End-of-period cost (bonded warehouses) in NIS'),
  // Field 1465: Reserved (50) - Optional - Alphanumeric
  reserved: z.string().max(50).default('').describe('Reserved field for future data'),
});

export type M100 = z.infer<typeof M100Schema>;

/**
 * Encodes a M100 record to fixed-width string format
 * Total line width: 294 characters + CRLF
 */
export function encodeM100(input: M100): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1450: Record code (4) - positions 1-4 - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Field 1451: Record number (9) - positions 5-13 - Numeric
    formatNumericField(input.vatId, 9), // Field 1452: VAT ID (9) - positions 14-22 - Numeric
    formatField(input.universalItemCode, 20, 'left'), // Field 1453: Universal item code (20) - positions 23-42 - Alphanumeric
    formatField(input.supplierItemCode, 20, 'left'), // Field 1454: Supplier item code (20) - positions 43-62 - Alphanumeric
    formatField(input.internalItemCode, 20, 'left'), // Field 1455: Internal item code (20) - positions 63-82 - Alphanumeric
    formatField(input.itemName, 50, 'left'), // Field 1456: Item name (50) - positions 83-132 - Alphanumeric
    formatField(input.classificationCode, 10, 'left'), // Field 1457: Classification code (10) - positions 133-142 - Alphanumeric
    formatField(input.classificationDescription, 30, 'left'), // Field 1458: Classification description (30) - positions 143-172 - Alphanumeric
    formatField(input.unitOfMeasure, 20, 'left'), // Field 1459: Unit of measure (20) - positions 173-192 - Alphanumeric
    formatField(input.openingStock, 12, 'left'), // Field 1460: Opening stock (12) - positions 193-204 - Alphanumeric
    formatField(input.totalStockIn, 12, 'left'), // Field 1461: Total stock in (12) - positions 205-216 - Alphanumeric
    formatField(input.totalStockOut, 12, 'left'), // Field 1462: Total stock out (12) - positions 217-228 - Alphanumeric
    formatField(input.endPeriodCostNonBonded, 8, 'left'), // Field 1463: End period cost non-bonded (8) - positions 229-236 - Numeric (optional, left-aligned)
    formatField(input.endPeriodCostBonded, 8, 'left'), // Field 1464: End period cost bonded (8) - positions 237-244 - Numeric (optional, left-aligned)
    formatField(input.reserved, 50, 'left'), // Field 1465: Reserved (50) - positions 245-294 - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width M100 record line back to object
 * Expected line length: 294 characters (excluding CRLF)
 */
export function parseM100(line: string): M100 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 294) {
    throw new Error(`Invalid M100 record length: expected 294 characters, got ${cleanLine.length}`);
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
  const universalItemCode = cleanLine.slice(pos, pos + 20).trim();
  pos += 20; // positions 23-42
  const supplierItemCode = cleanLine.slice(pos, pos + 20).trim();
  pos += 20; // positions 43-62
  const internalItemCode = cleanLine.slice(pos, pos + 20).trim();
  pos += 20; // positions 63-82
  const itemName = cleanLine.slice(pos, pos + 50).trim();
  pos += 50; // positions 83-132
  const classificationCode = cleanLine.slice(pos, pos + 10).trim();
  pos += 10; // positions 133-142
  const classificationDescription = cleanLine.slice(pos, pos + 30).trim();
  pos += 30; // positions 143-172
  const unitOfMeasure = cleanLine.slice(pos, pos + 20).trim();
  pos += 20; // positions 173-192
  const openingStock = cleanLine.slice(pos, pos + 12).trim();
  pos += 12; // positions 193-204
  const totalStockIn = cleanLine.slice(pos, pos + 12).trim();
  pos += 12; // positions 205-216
  const totalStockOut = cleanLine.slice(pos, pos + 12).trim();
  pos += 12; // positions 217-228
  const endPeriodCostNonBonded = cleanLine.slice(pos, pos + 8).trim();
  const processedEndPeriodCostNonBonded = endPeriodCostNonBonded
    ? endPeriodCostNonBonded.replace(/^0+/, '') || endPeriodCostNonBonded
    : '';
  pos += 8; // positions 229-236
  const endPeriodCostBonded = cleanLine.slice(pos, pos + 8).trim();
  const processedEndPeriodCostBonded = endPeriodCostBonded
    ? endPeriodCostBonded.replace(/^0+/, '') || endPeriodCostBonded
    : '';
  pos += 8; // positions 237-244
  const reserved = cleanLine.slice(pos, pos + 50).trim();

  // Validate the code field
  if (code !== 'M100') {
    throw new Error(`Invalid M100 record code: expected "M100", got "${code}"`);
  }

  const parsed: M100 = {
    code,
    recordNumber,
    vatId,
    universalItemCode,
    supplierItemCode,
    internalItemCode,
    itemName,
    classificationCode,
    classificationDescription,
    unitOfMeasure,
    openingStock,
    totalStockIn,
    totalStockOut,
    endPeriodCostNonBonded: processedEndPeriodCostNonBonded,
    endPeriodCostBonded: processedEndPeriodCostBonded,
    reserved,
  };

  // Validate against schema
  return M100Schema.parse(parsed);
}
