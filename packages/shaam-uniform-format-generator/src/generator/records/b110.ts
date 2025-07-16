import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../format/encoder.js';

/**
 * B110 Record Schema - Account record
 * Fields 1400-1424 based on SHAAM 1.31 specification table
 */
export const B110Schema = z.object({
  // Field 1400: Record code (4) - Required - Alphanumeric
  code: z.literal('B110').describe('Record type code - always "B110"'),
  // Field 1401: Record number in file (9) - Required - Numeric
  recordNumber: z
    .string()
    .min(1)
    .max(9)
    .regex(/^\d+$/)
    .describe('Sequential record number in file'),
  // Field 1402: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('Tax identification number'),
  // Field 1403: Account key (15) - Required - Alphanumeric
  accountKey: z.string().min(1).max(15).describe('Account key - must be unique'),
  // Field 1404: Account name (50) - Required - Alphanumeric
  accountName: z.string().min(1).max(50).describe('Account name'),
  // Field 1405: Trial balance code (15) - Required - Alphanumeric
  trialBalanceCode: z.string().min(1).max(15).describe('Trial balance code'),
  // Field 1406: Trial balance code description (30) - Required - Alphanumeric
  trialBalanceCodeDescription: z.string().min(1).max(30).describe('Trial balance code description'),
  // Field 1407: Customer/Supplier address - street (50) - Optional - Alphanumeric
  customerSupplierAddressStreet: z
    .string()
    .max(50)
    .default('')
    .describe('Customer/Supplier address - street (only for customer/supplier accounts)'),
  // Field 1408: Customer/Supplier address - house number (10) - Optional - Alphanumeric
  customerSupplierAddressHouseNumber: z
    .string()
    .max(10)
    .default('')
    .describe('Customer/Supplier address - house number (only for customer/supplier accounts)'),
  // Field 1409: Customer/Supplier address - city (30) - Optional - Alphanumeric
  customerSupplierAddressCity: z
    .string()
    .max(30)
    .default('')
    .describe('Customer/Supplier address - city (only for customer/supplier accounts)'),
  // Field 1410: Customer/Supplier address - ZIP (8) - Optional - Alphanumeric
  customerSupplierAddressZip: z
    .string()
    .max(8)
    .default('')
    .describe('Customer/Supplier address - ZIP (only for customer/supplier accounts)'),
  // Field 1411: Customer/Supplier address - country (30) - Optional - Alphanumeric
  customerSupplierAddressCountry: z
    .string()
    .max(30)
    .default('')
    .describe('Customer/Supplier address - country (only for customer/supplier accounts)'),
  // Field 1412: Country code (2) - Optional - Alphanumeric
  countryCode: z
    .string()
    .max(2)
    .default('')
    .describe('Country code (only for customer/supplier accounts, see Appendix 3)'),
  // Field 1413: Parent account key (15) - Optional - Alphanumeric
  parentAccountKey: z.string().max(15).default('').describe('Parent account key'),
  // Field 1414: Account opening balance (15) - Optional - Alphanumeric - Format: X9(12)V99
  accountOpeningBalance: z
    .string()
    .max(15)
    .default('')
    .describe('Account opening balance (positive = debit, negative = credit)'),
  // Field 1415: Total debits (15) - Optional - Alphanumeric - Format: X9(12)V99
  totalDebits: z.string().max(15).default('').describe('Total debits (excludes opening balance)'),
  // Field 1416: Total credits (15) - Optional - Alphanumeric - Format: X9(12)V99
  totalCredits: z.string().max(15).default('').describe('Total credits (excludes opening balance)'),
  // Field 1417: Accounting classification code (4) - Conditional - Numeric
  accountingClassificationCode: z
    .string()
    .max(4)
    .regex(/^$|^\d+$/)
    .default('')
    .describe('Accounting classification code (mandatory if 6111 report required)'),
  // Field 1418: Reserved field (0) - Deprecated - Alphanumeric - Skipped as it has 0 length
  // Field 1419: Supplier/Customer tax ID (9) - Conditional - Numeric
  supplierCustomerTaxId: z
    .string()
    .max(9)
    .regex(/^$|^\d+$/)
    .default('')
    .describe(
      'Supplier/Customer tax ID (required if double-entry bookkeeping, code 2 in field 1013)',
    ),
  // Field 1420: Reserved field (0) - Deprecated - Alphanumeric - Skipped as it has 0 length
  // Field 1421: Branch ID (7) - Conditional - Alphanumeric
  branchId: z
    .string()
    .max(7)
    .default('')
    .describe('Branch ID (required if field 1034 = 1, see Note 3)'),
  // Field 1422: Opening balance in foreign currency (15) - Optional - Alphanumeric - Format: X9(12)V99
  openingBalanceForeignCurrency: z
    .string()
    .max(15)
    .default('')
    .describe('Opening balance in foreign currency'),
  // Field 1423: Foreign currency code (3) - Optional - Alphanumeric
  foreignCurrencyCode: z
    .string()
    .max(3)
    .default('')
    .describe('Foreign currency code (refers to field 1422, see Appendix 2)'),
  // Field 1424: Reserved field (16) - Optional - Alphanumeric
  reserved: z.string().max(16).default('').describe('Reserved field for future use'),
});

export type B110 = z.infer<typeof B110Schema>;

/**
 * Encodes a B110 record to fixed-width string format
 * Total line width: 376 characters + CRLF
 */
export function encodeB110(input: B110): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1400: Record code (4)
    formatNumericField(input.recordNumber, 9), // Field 1401: Record number (9)
    formatNumericField(input.vatId, 9), // Field 1402: VAT ID (9)
    formatField(input.accountKey, 15, 'left'), // Field 1403: Account key (15)
    formatField(input.accountName, 50, 'left'), // Field 1404: Account name (50)
    formatField(input.trialBalanceCode, 15, 'left'), // Field 1405: Trial balance code (15)
    formatField(input.trialBalanceCodeDescription, 30, 'left'), // Field 1406: Trial balance code description (30)
    formatField(input.customerSupplierAddressStreet, 50, 'left'), // Field 1407: Customer/Supplier address - street (50)
    formatField(input.customerSupplierAddressHouseNumber, 10, 'left'), // Field 1408: Customer/Supplier address - house number (10)
    formatField(input.customerSupplierAddressCity, 30, 'left'), // Field 1409: Customer/Supplier address - city (30)
    formatField(input.customerSupplierAddressZip, 8, 'left'), // Field 1410: Customer/Supplier address - ZIP (8)
    formatField(input.customerSupplierAddressCountry, 30, 'left'), // Field 1411: Customer/Supplier address - country (30)
    formatField(input.countryCode, 2, 'left'), // Field 1412: Country code (2)
    formatField(input.parentAccountKey, 15, 'left'), // Field 1413: Parent account key (15)
    formatField(input.accountOpeningBalance, 15, 'right'), // Field 1414: Account opening balance (15) - right-aligned for amount
    formatField(input.totalDebits, 15, 'right'), // Field 1415: Total debits (15) - right-aligned for amount
    formatField(input.totalCredits, 15, 'right'), // Field 1416: Total credits (15) - right-aligned for amount
    formatNumericField(input.accountingClassificationCode, 4), // Field 1417: Accounting classification code (4)
    // Field 1418: Reserved field (0) - skipped as it has 0 length
    formatNumericField(input.supplierCustomerTaxId, 9), // Field 1419: Supplier/Customer tax ID (9)
    // Field 1420: Reserved field (0) - skipped as it has 0 length
    formatField(input.branchId, 7, 'left'), // Field 1421: Branch ID (7)
    formatField(input.openingBalanceForeignCurrency, 15, 'right'), // Field 1422: Opening balance in foreign currency (15) - right-aligned for amount
    formatField(input.foreignCurrencyCode, 3, 'left'), // Field 1423: Foreign currency code (3)
    formatField(input.reserved, 16, 'left'), // Field 1424: Reserved field (16)
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width B110 record line back to object
 * Expected line length: 376 characters (excluding CRLF)
 */
export function parseB110(line: string): B110 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 376) {
    throw new Error(`Invalid B110 record length: expected 376 characters, got ${cleanLine.length}`);
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
  const accountKey = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const accountName = cleanLine.slice(pos, pos + 50).trim();
  pos += 50;
  const trialBalanceCode = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const trialBalanceCodeDescription = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const customerSupplierAddressStreet = cleanLine.slice(pos, pos + 50).trim();
  pos += 50;
  const customerSupplierAddressHouseNumber = cleanLine.slice(pos, pos + 10).trim();
  pos += 10;
  const customerSupplierAddressCity = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const customerSupplierAddressZip = cleanLine.slice(pos, pos + 8).trim();
  pos += 8;
  const customerSupplierAddressCountry = cleanLine.slice(pos, pos + 30).trim();
  pos += 30;
  const countryCode = cleanLine.slice(pos, pos + 2).trim();
  pos += 2;
  const parentAccountKey = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const accountOpeningBalance = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const totalDebits = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const totalCredits = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const accountingClassificationCode =
    cleanLine
      .slice(pos, pos + 4)
      .trim()
      .replace(/^0+/, '') || '';
  pos += 4;
  // Field 1418: Reserved field (0) - skipped as it has 0 length
  const supplierCustomerTaxId =
    cleanLine
      .slice(pos, pos + 9)
      .trim()
      .replace(/^0+/, '') || '';
  pos += 9;
  // Field 1420: Reserved field (0) - skipped as it has 0 length
  const branchId = cleanLine.slice(pos, pos + 7).trim();
  pos += 7;
  const openingBalanceForeignCurrency = cleanLine.slice(pos, pos + 15).trim();
  pos += 15;
  const foreignCurrencyCode = cleanLine.slice(pos, pos + 3).trim();
  pos += 3;
  const reserved = cleanLine.slice(pos, pos + 16).trim();
  pos += 16;

  // Validate the code field
  if (code !== 'B110') {
    throw new Error(`Invalid B110 record code: expected "B110", got "${code}"`);
  }

  const parsed: B110 = {
    code,
    recordNumber,
    vatId,
    accountKey,
    accountName,
    trialBalanceCode,
    trialBalanceCodeDescription,
    customerSupplierAddressStreet,
    customerSupplierAddressHouseNumber,
    customerSupplierAddressCity,
    customerSupplierAddressZip,
    customerSupplierAddressCountry,
    countryCode,
    parentAccountKey,
    accountOpeningBalance,
    totalDebits,
    totalCredits,
    accountingClassificationCode,
    supplierCustomerTaxId,
    branchId,
    openingBalanceForeignCurrency,
    foreignCurrencyCode,
    reserved,
  };

  // Validate against schema
  return B110Schema.parse(parsed);
}
