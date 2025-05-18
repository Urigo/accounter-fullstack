import { HeaderRecord } from '../types/index.js';

/**
 * Safely parses a string to an integer with a fallback value
 * @param value The string to parse
 * @param fallback The fallback value if parsing fails
 * @returns The parsed integer or fallback value
 */
function parseIntWithFallback<T extends number | undefined>(
  value: string,
  fallback: T,
): number | T {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = parseInt(trimmed);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parses a single character to an integer with a fallback value
 * @param char The character to parse
 * @param fallback The fallback value if parsing fails
 * @returns The parsed integer or fallback value
 */
function parseCharWithFallback<T extends number | undefined>(
  char: string,
  fallback: T,
): number | T {
  if (!char) return fallback;
  const parsed = parseInt(char);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely extracts a string field with optional trimming
 * @param str The source string
 * @param start The starting index (inclusive)
 * @param end The ending index (exclusive)
 * @param makeUndefinedIfEmpty Whether to return undefined for empty strings
 * @returns The extracted substring or undefined
 */
function extractString(
  str: string,
  start: number,
  end: number,
  makeUndefinedIfEmpty = true,
): string | undefined {
  const value = str.substring(start, end).trim();
  return value || (makeUndefinedIfEmpty ? undefined : value);
}

/**
 * Parses the header section of the report content
 * @param headerLine - The line containing header information
 * @returns A HeaderRecord object
 */
export function parseHeaderRecord(headerLine: string): HeaderRecord {
  // Ensure we have data to parse
  if (!headerLine || headerLine.length < 142) {
    throw new Error('Invalid header line: Insufficient data');
  }

  // Extract header fields according to the specification
  const header: HeaderRecord = {
    taxFileNumber: extractString(headerLine, 0, 9, false) || '',
    taxYear: extractString(headerLine, 9, 13, false) || '',
    idNumber: extractString(headerLine, 13, 22, false) || '',
    vatFileNumber: extractString(headerLine, 22, 31),
    withholdingTaxFileNumber: extractString(headerLine, 31, 40),
    industryCode: extractString(headerLine, 40, 44, false) || '',
    businessDescription: extractString(headerLine, 44, 94),
    businessType: parseIntWithFallback(headerLine.substring(94, 96), 0),
    reportingMethod: parseIntWithFallback(headerLine.substring(96, 98), 0),
    accountingMethod: parseIntWithFallback(headerLine.substring(98, 100), 0),
    accountingSystem: parseIntWithFallback(headerLine.substring(100, 102), 0),
    isPartnership: parseCharWithFallback(headerLine.charAt(102), undefined),
    includesProfitLoss: parseCharWithFallback(headerLine.charAt(103), 0),
    includesTaxAdjustment: parseCharWithFallback(headerLine.charAt(104), 0),
    includesBalanceSheet: parseCharWithFallback(headerLine.charAt(105), 0),
    profitLossEntryCount: parseIntWithFallback(headerLine.substring(106, 109), undefined),
    taxAdjustmentEntryCount: parseIntWithFallback(headerLine.substring(109, 112), undefined),
    balanceSheetEntryCount: parseIntWithFallback(headerLine.substring(112, 115), undefined),
    ifrsImplementationYear: extractString(headerLine, 115, 119),
    ifrsReportingOption: parseCharWithFallback(headerLine.charAt(119), undefined),
    softwareRegistrationNumber: extractString(headerLine, 120, 128),
    partnershipCount: parseIntWithFallback(headerLine.substring(128, 131), undefined),
    partnershipProfitShare: parseIntWithFallback(headerLine.substring(131, 137), undefined),
    currencyType: parseIntWithFallback(headerLine.substring(137, 139), 0),
    auditOpinionType: parseIntWithFallback(headerLine.substring(139, 141), undefined),
    amountsInThousands: parseCharWithFallback(headerLine.charAt(141), 2),
  };

  return header;
}
