import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { defaultKeyGenerator } from '../../utils/key-generator.js';
import { formatField, formatNumericField, joinFields } from '../format/encoder.js';

/**
 * A000 Record Schema - INI.TXT file header record
 * Fields 1000-1035 based on SHAAM uniform format specification
 */
export const A000Schema = z.object({
  // Field 1000: Record Code (4) - Required - Alphanumeric
  code: z.literal('A000').describe('Record type code - always "A000"'),
  // Field 1001: Reserved for Future Use (5) - Required - Alphanumeric
  reservedFuture: z.string().max(5).default('').optional().describe('Reserved for future use'),
  // Field 1002: Total Records in BKMVDATA (15) - Required - Numeric
  totalRecords: z.string().min(1).max(15).regex(/^\d+$/).describe('Total records in BKMVDATA file'),
  // Field 1003: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1004: Primary Identifier (15) - Required - Numeric
  primaryIdentifier: z
    .string()
    .min(1)
    .max(15)
    .regex(/^\d+$/)
    .describe('Fixed and unique primary identifier per file'),
  // Field 1005: System Constant (8) - Required - Alphanumeric
  systemConstant: z.literal(SHAAM_VERSION).describe(`System constant - always "${SHAAM_VERSION}"`),
  // Field 1006: Software Registration Number (8) - Required - Numeric
  softwareRegNumber: z
    .string()
    .min(1)
    .max(8)
    .regex(/^\d+$/)
    .describe('Software registration number'),
  // Field 1007: Software Name (20) - Required - Alphanumeric
  softwareName: z.string().min(1).max(20).describe('Software name'),
  // Field 1008: Software Version (20) - Required - Alphanumeric
  softwareVersion: z.string().min(1).max(20).describe('Software version'),
  // Field 1009: Vendor Tax ID (9) - Required - Numeric
  vendorVatId: z.string().min(1).max(9).regex(/^\d+$/).describe('Software vendor VAT ID'),
  // Field 1010: Vendor Name (20) - Required - Alphanumeric
  vendorName: z.string().min(1).max(20).describe('Software vendor name'),
  // Field 1011: Software Type (1) - Required - Numeric
  softwareType: z.enum(['1', '2']).describe('Software type: 1=Single-year, 2=Multi-year'),
  // Field 1012: File Output Path (50) - Required - Alphanumeric
  fileOutputPath: z.string().min(1).max(50).describe('File output path'),
  // Field 1013: Accounting Type (1) - Required - Numeric
  accountingType: z
    .enum(['0', '1', '2'])
    .describe('Accounting type: 0=N/A, 1=Single-entry, 2=Double-entry'),
  // Field 1014: Balance Required Flag (1) - Required - Numeric
  balanceRequired: z
    .enum(['0', '1', '2'])
    .describe('Balance required flag: 0=Not required, 1=Required, 2=Other'),
  // Field 1015: Company Registrar ID (9) - Optional - Numeric
  companyRegId: z.string().max(9).regex(/^\d*$/).default('').describe('Company registrar ID'),
  // Field 1016: Withholding File Number (9) - Optional - Numeric
  withholdingFileNum: z
    .string()
    .max(9)
    .regex(/^\d*$/)
    .default('')
    .describe('Withholding file number'),
  // Field 1017: Reserved Field (10) - Optional - Alphanumeric
  reserved1017: z.string().max(10).default('').optional().describe('Reserved field'),
  // Field 1018: Business Name (50) - Required - Alphanumeric
  businessName: z.string().max(50).describe('Business name'),
  // Field 1019: Business Address - Street (50) - Optional - Alphanumeric
  businessStreet: z.string().max(50).default('').describe('Business address - street'),
  // Field 1020: Business Address - House Number (10) - Optional - Alphanumeric
  businessHouseNum: z.string().max(10).default('').describe('Business address - house number'),
  // Field 1021: Business Address - City (30) - Optional - Alphanumeric
  businessCity: z.string().max(30).default('').describe('Business address - city'),
  // Field 1022: Business Address - ZIP (8) - Optional - Alphanumeric
  businessZip: z.string().max(8).default('').describe('Business address - ZIP code'),
  // Field 1023: Tax Year (4) - Conditional - Numeric
  taxYear: z
    .string()
    .max(4)
    .regex(/^\d*$/)
    .default('')
    .describe('Tax year (required if single-year software)'),
  // Field 1024: Start/Cutoff Date (8) - Conditional - Numeric
  startDate: z
    .string()
    .max(8)
    .regex(/^\d*$/)
    .default('')
    .describe('Start/cutoff date YYYYMMDD (required if multi-year)'),
  // Field 1025: End/Cutoff Date (8) - Conditional - Numeric
  endDate: z
    .string()
    .max(8)
    .regex(/^\d*$/)
    .default('')
    .describe('End/cutoff date YYYYMMDD (required if multi-year)'),
  // Field 1026: Process Start Date (8) - Required - Numeric
  processStartDate: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Process start date YYYYMMDD'),
  // Field 1027: Process Start Time (4) - Required - Numeric
  processStartTime: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .describe('Process start time HHMM'),
  // Field 1028: Language Code (1) - Required - Numeric
  languageCode: z.enum(['0', '1', '2']).describe('Language code: 0=Hebrew, 1=Arabic, 2=Other'),
  // Field 1029: Character Encoding (1) - Required - Numeric
  characterEncoding: z.enum(['1', '2']).describe('Character encoding: 1=ISO-8859-8-i, 2=CP-862'),
  // Field 1030: Compression Software Name (20) - Optional - Alphanumeric
  compressionSoftware: z.string().max(20).default('').describe('Compression software name'),
  // Field 1031: Reserved Field (0) - Deprecated - Alphanumeric
  reserved1031: z.string().max(0).default('').optional().describe('Deprecated reserved field'),
  // Field 1032: Base Currency Code (3) - Optional - Alphanumeric
  baseCurrency: z.string().max(3).default('ILS').describe('Base currency code (default: ILS)'),
  // Field 1033: Reserved Field (0) - Deprecated - Alphanumeric
  reserved1033: z.string().max(0).default('').optional().describe('Deprecated reserved field'),
  // Field 1034: Branch Info Flag (1) - Required - Numeric
  branchInfoFlag: z.enum(['0', '1']).describe('Branch info flag: 0=No branches, 1=Has branches'),
  // Field 1035: Reserved Field (46) - Optional - Alphanumeric
  reserved1035: z.string().max(46).default('').optional().describe('Reserved field'),
});

/**
 * A000 Input Schema - for user input (excludes auto-generated fields)
 */
export const A000InputSchema = A000Schema.omit({
  code: true,
  primaryIdentifier: true,
  systemConstant: true,
});

export type A000 = z.infer<typeof A000Schema>;
export type A000Input = z.infer<typeof A000InputSchema>;

/**
 * Encodes an A000 record to fixed-width string format
 * Total line width: 466 characters + CRLF
 */
export function encodeA000(input: A000Input): string {
  const primaryIdentifier = defaultKeyGenerator.getPrimaryIdentifier();

  const fullRecord: A000 = {
    code: 'A000',
    primaryIdentifier,
    systemConstant: SHAAM_VERSION,
    ...input,
  };

  const fields = [
    formatField(fullRecord.code, 4, 'left'), // Field 1000: Record code (4)
    formatField(fullRecord.reservedFuture ?? '', 5, 'left'), // Field 1001: Reserved future (5)
    formatNumericField(fullRecord.totalRecords, 15), // Field 1002: Total records (15)
    formatNumericField(fullRecord.vatId, 9), // Field 1003: VAT ID (9)
    formatNumericField(fullRecord.primaryIdentifier, 15), // Field 1004: Primary identifier (15)
    formatField(fullRecord.systemConstant, 8, 'left'), // Field 1005: System constant (8)
    formatNumericField(fullRecord.softwareRegNumber, 8), // Field 1006: Software reg number (8)
    formatField(fullRecord.softwareName, 20, 'left'), // Field 1007: Software name (20)
    formatField(fullRecord.softwareVersion, 20, 'left'), // Field 1008: Software version (20)
    formatNumericField(fullRecord.vendorVatId, 9), // Field 1009: Vendor VAT ID (9)
    formatField(fullRecord.vendorName, 20, 'left'), // Field 1010: Vendor name (20)
    formatNumericField(fullRecord.softwareType, 1), // Field 1011: Software type (1)
    formatField(fullRecord.fileOutputPath, 50, 'left'), // Field 1012: File output path (50)
    formatNumericField(fullRecord.accountingType, 1), // Field 1013: Accounting type (1)
    formatNumericField(fullRecord.balanceRequired, 1), // Field 1014: Balance required (1)
    formatNumericField(fullRecord.companyRegId, 9), // Field 1015: Company reg ID (9)
    formatNumericField(fullRecord.withholdingFileNum, 9), // Field 1016: Withholding file num (9)
    formatField(fullRecord.reserved1017 ?? '', 10, 'left'), // Field 1017: Reserved (10)
    formatField(fullRecord.businessName, 50, 'left'), // Field 1018: Business name (50)
    formatField(fullRecord.businessStreet, 50, 'left'), // Field 1019: Business street (50)
    formatField(fullRecord.businessHouseNum, 10, 'left'), // Field 1020: Business house num (10)
    formatField(fullRecord.businessCity, 30, 'left'), // Field 1021: Business city (30)
    formatField(fullRecord.businessZip, 8, 'left'), // Field 1022: Business ZIP (8)
    formatNumericField(fullRecord.taxYear, 4), // Field 1023: Tax year (4)
    formatNumericField(fullRecord.startDate, 8), // Field 1024: Start date (8)
    formatNumericField(fullRecord.endDate, 8), // Field 1025: End date (8)
    formatNumericField(fullRecord.processStartDate, 8), // Field 1026: Process start date (8)
    formatNumericField(fullRecord.processStartTime, 4), // Field 1027: Process start time (4)
    formatNumericField(fullRecord.languageCode, 1), // Field 1028: Language code (1)
    formatNumericField(fullRecord.characterEncoding, 1), // Field 1029: Character encoding (1)
    formatField(fullRecord.compressionSoftware, 20, 'left'), // Field 1030: Compression software (20)
    formatField(fullRecord.reserved1031 ?? '', 0, 'left'), // Field 1031: Reserved (0)
    formatField(fullRecord.baseCurrency, 3, 'left'), // Field 1032: Base currency (3)
    formatField(fullRecord.reserved1033 ?? '', 0, 'left'), // Field 1033: Reserved (0)
    formatNumericField(fullRecord.branchInfoFlag, 1), // Field 1034: Branch info flag (1)
    formatField(fullRecord.reserved1035 ?? '', 46, 'left'), // Field 1035: Reserved (46)
  ];

  return joinFields(fields);
}

/**
 * Parses a fixed-width A000 record line back to object
 * Expected line length: 466 characters (excluding CRLF)
 */
export function parseA000(line: string): A000 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 466) {
    throw new Error(`Invalid A000 record length: expected 466 characters, got ${cleanLine.length}`);
  }

  let offset = 0;

  // Extract fields at their fixed positions
  const code = cleanLine.slice(offset, offset + 4).trim();
  offset += 4; // Field 1000 (4)
  const reservedFuture = cleanLine.slice(offset, offset + 5).trim();
  offset += 5; // Field 1001 (5)
  const totalRecords =
    cleanLine
      .slice(offset, offset + 15)
      .trim()
      .replace(/^0+/, '') || '0';
  offset += 15; // Field 1002 (15)
  const vatId =
    cleanLine
      .slice(offset, offset + 9)
      .trim()
      .replace(/^0+/, '') || '0';
  offset += 9; // Field 1003 (9)
  const primaryIdentifier =
    cleanLine
      .slice(offset, offset + 15)
      .trim()
      .replace(/^0+/, '') || '0';
  offset += 15; // Field 1004 (15)
  const systemConstant = cleanLine.slice(offset, offset + 8).trim();
  offset += 8; // Field 1005 (8)
  const softwareRegNumber =
    cleanLine
      .slice(offset, offset + 8)
      .trim()
      .replace(/^0+/, '') || '0';
  offset += 8; // Field 1006 (8)
  const softwareName = cleanLine.slice(offset, offset + 20).trim();
  offset += 20; // Field 1007 (20)
  const softwareVersion = cleanLine.slice(offset, offset + 20).trim();
  offset += 20; // Field 1008 (20)
  const vendorVatId =
    cleanLine
      .slice(offset, offset + 9)
      .trim()
      .replace(/^0+/, '') || '0';
  offset += 9; // Field 1009 (9)
  const vendorName = cleanLine.slice(offset, offset + 20).trim();
  offset += 20; // Field 1010 (20)
  const softwareType = cleanLine.slice(offset, offset + 1).trim();
  offset += 1; // Field 1011 (1)
  const fileOutputPath = cleanLine.slice(offset, offset + 50).trim();
  offset += 50; // Field 1012 (50)
  const accountingType = cleanLine.slice(offset, offset + 1).trim();
  offset += 1; // Field 1013 (1)
  const balanceRequired = cleanLine.slice(offset, offset + 1).trim();
  offset += 1; // Field 1014 (1)
  const companyRegId =
    cleanLine
      .slice(offset, offset + 9)
      .trim()
      .replace(/^0+/, '') || '';
  offset += 9; // Field 1015 (9)
  const withholdingFileNum =
    cleanLine
      .slice(offset, offset + 9)
      .trim()
      .replace(/^0+/, '') || '';
  offset += 9; // Field 1016 (9)
  const reserved1017 = cleanLine.slice(offset, offset + 10).trim();
  offset += 10; // Field 1017 (10)
  const businessName = cleanLine.slice(offset, offset + 50).trim() || '';
  offset += 50; // Field 1018 (50)
  const businessStreet = cleanLine.slice(offset, offset + 50).trim();
  offset += 50; // Field 1019 (50)
  const businessHouseNum = cleanLine.slice(offset, offset + 10).trim();
  offset += 10; // Field 1020 (10)
  const businessCity = cleanLine.slice(offset, offset + 30).trim();
  offset += 30; // Field 1021 (30)
  const businessZip = cleanLine.slice(offset, offset + 8).trim();
  offset += 8; // Field 1022 (8)
  const taxYear =
    cleanLine
      .slice(offset, offset + 4)
      .trim()
      .replace(/^0+/, '') || '';
  offset += 4; // Field 1023 (4)
  const startDate =
    cleanLine
      .slice(offset, offset + 8)
      .trim()
      .replace(/^0+/, '') || '';
  offset += 8; // Field 1024 (8)
  const endDate =
    cleanLine
      .slice(offset, offset + 8)
      .trim()
      .replace(/^0+/, '') || '';
  offset += 8; // Field 1025 (8)
  const processStartDate = cleanLine.slice(offset, offset + 8).trim();
  offset += 8; // Field 1026 (8)
  const processStartTime = cleanLine.slice(offset, offset + 4).trim();
  offset += 4; // Field 1027 (4)
  const languageCode = cleanLine.slice(offset, offset + 1).trim();
  offset += 1; // Field 1028 (1)
  const characterEncoding = cleanLine.slice(offset, offset + 1).trim();
  offset += 1; // Field 1029 (1)
  const compressionSoftware = cleanLine.slice(offset, offset + 20).trim();
  offset += 20; // Field 1030 (20)
  const reserved1031 = cleanLine.slice(offset, offset + 0).trim();
  offset += 0; // Field 1031 (0)
  const baseCurrency = cleanLine.slice(offset, offset + 3).trim();
  offset += 3; // Field 1032 (3)
  const reserved1033 = cleanLine.slice(offset, offset + 0).trim();
  offset += 0; // Field 1033 (0)
  const branchInfoFlag = cleanLine.slice(offset, offset + 1).trim();
  offset += 1; // Field 1034 (1)
  const reserved1035 = cleanLine.slice(offset, offset + 46).trim(); // Field 1035 (46)

  // Validate the code field
  if (code !== 'A000') {
    throw new Error(`Invalid A000 record code: expected "A000", got "${code}"`);
  }

  // Validate the system constant field
  if (systemConstant !== SHAAM_VERSION) {
    throw new Error(
      `Invalid system constant: expected "${SHAAM_VERSION}", got "${systemConstant}"`,
    );
  }

  const parsed: A000 = {
    code,
    reservedFuture,
    totalRecords,
    vatId,
    primaryIdentifier,
    systemConstant: SHAAM_VERSION,
    softwareRegNumber,
    softwareName,
    softwareVersion,
    vendorVatId,
    vendorName,
    softwareType: softwareType as '1' | '2',
    fileOutputPath,
    accountingType: accountingType as '0' | '1' | '2',
    balanceRequired: balanceRequired as '0' | '1' | '2',
    companyRegId,
    withholdingFileNum,
    reserved1017,
    businessName,
    businessStreet,
    businessHouseNum,
    businessCity,
    businessZip,
    taxYear,
    startDate,
    endDate,
    processStartDate,
    processStartTime,
    languageCode: languageCode as '0' | '1' | '2',
    characterEncoding: characterEncoding as '1' | '2',
    compressionSoftware,
    reserved1031,
    baseCurrency,
    reserved1033,
    branchInfoFlag: branchInfoFlag as '0' | '1',
    reserved1035,
  };

  // Validate against schema
  return A000Schema.parse(parsed);
}
