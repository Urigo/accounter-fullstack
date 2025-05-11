import { HeaderRecord } from '../types/index.js';

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
    taxFileNumber: headerLine.substring(0, 9).trim(),
    taxYear: headerLine.substring(9, 13).trim(),
    idNumber: headerLine.substring(13, 22).trim(),
    vatFileNumber: headerLine.substring(22, 31).trim() || undefined,
    withholdingTaxFileNumber: headerLine.substring(31, 40).trim() || undefined,
    industryCode: headerLine.substring(40, 44).trim(),
    businessDescription: headerLine.substring(44, 94).trim() || undefined,
    businessType: Number.isNaN(parseInt(headerLine.substring(94, 96).trim()))
      ? 0
      : parseInt(headerLine.substring(94, 96).trim()),
    reportingMethod: Number.isNaN(parseInt(headerLine.substring(96, 98).trim()))
      ? 0
      : parseInt(headerLine.substring(96, 98).trim()),
    accountingMethod: Number.isNaN(parseInt(headerLine.substring(98, 100).trim()))
      ? 0
      : parseInt(headerLine.substring(98, 100).trim()),
    accountingSystem: Number.isNaN(parseInt(headerLine.substring(100, 102).trim()))
      ? 0
      : parseInt(headerLine.substring(100, 102).trim()),
    isPartnership: Number.isNaN(parseInt(headerLine.charAt(102)))
      ? undefined
      : parseInt(headerLine.charAt(102)),
    includesProfitLoss: Number.isNaN(parseInt(headerLine.charAt(103)))
      ? 0
      : parseInt(headerLine.charAt(103)),
    includesTaxAdjustment: Number.isNaN(parseInt(headerLine.charAt(104)))
      ? 0
      : parseInt(headerLine.charAt(104)),
    includesBalanceSheet: Number.isNaN(parseInt(headerLine.charAt(105)))
      ? 0
      : parseInt(headerLine.charAt(105)),
    profitLossEntryCount: Number.isNaN(parseInt(headerLine.substring(106, 109).trim()))
      ? undefined
      : parseInt(headerLine.substring(106, 109).trim()),
    taxAdjustmentEntryCount: Number.isNaN(parseInt(headerLine.substring(109, 112).trim()))
      ? undefined
      : parseInt(headerLine.substring(109, 112).trim()),
    balanceSheetEntryCount: Number.isNaN(parseInt(headerLine.substring(112, 115).trim()))
      ? undefined
      : parseInt(headerLine.substring(112, 115).trim()),
    ifrsImplementationYear: headerLine.substring(115, 119).trim().length
      ? headerLine.substring(115, 119).trim()
      : undefined,
    ifrsReportingOption: Number.isNaN(parseInt(headerLine.charAt(119)))
      ? undefined
      : parseInt(headerLine.charAt(119)),
    softwareRegistrationNumber: headerLine.substring(120, 128).trim().length
      ? headerLine.substring(120, 128).trim()
      : undefined,
    partnershipCount: Number.isNaN(parseInt(headerLine.substring(128, 131).trim()))
      ? undefined
      : parseInt(headerLine.substring(128, 131).trim()),
    partnershipProfitShare: Number.isNaN(parseInt(headerLine.substring(131, 137).trim()))
      ? undefined
      : parseInt(headerLine.substring(131, 137).trim()),
    currencyType: Number.isNaN(parseInt(headerLine.substring(137, 139).trim()))
      ? 0
      : parseInt(headerLine.substring(137, 139).trim()),
    auditOpinionType: Number.isNaN(parseInt(headerLine.substring(139, 141).trim()))
      ? undefined
      : parseInt(headerLine.substring(139, 141).trim()),
    amountsInThousands: parseInt(
      Number.isNaN(parseInt(headerLine.charAt(141))) ? '2' : headerLine.charAt(141),
    ),
  };

  return header;
}
