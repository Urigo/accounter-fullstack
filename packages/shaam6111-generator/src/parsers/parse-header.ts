import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  HeaderRecord,
  IfrsReportingOption,
  ReportingMethod,
  YesNo,
} from '../types/index.js';

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
    businessType: parseInt(headerLine.substring(94, 96).trim() || '0') as BusinessType,
    reportingMethod: parseInt(headerLine.substring(96, 98).trim() || '0') as ReportingMethod,
    accountingMethod: parseInt(headerLine.substring(98, 100).trim() || '0') as AccountingMethod,
    accountingSystem: parseInt(headerLine.substring(100, 102).trim() || '0') as AccountingSystem,
    isPartnership:
      headerLine.length > 103 ? (parseInt(headerLine.charAt(102)) as YesNo) : undefined,
    includesProfitLoss: parseInt(headerLine.charAt(103)) as YesNo,
    includesTaxAdjustment: parseInt(headerLine.charAt(104)) as YesNo,
    includesBalanceSheet: parseInt(headerLine.charAt(105)) as YesNo,
    profitLossEntryCount:
      headerLine.length > 110 ? parseInt(headerLine.substring(106, 109).trim()) : undefined,
    taxAdjustmentEntryCount:
      headerLine.length > 113 ? parseInt(headerLine.substring(109, 112).trim()) : undefined,
    balanceSheetEntryCount:
      headerLine.length > 116 ? parseInt(headerLine.substring(112, 115).trim()) : undefined,
    ifrsImplementationYear:
      headerLine.length > 120 ? headerLine.substring(115, 119).trim() : undefined,
    ifrsReportingOption:
      headerLine.length > 121
        ? (parseInt(headerLine.charAt(119)) as IfrsReportingOption)
        : undefined,
    softwareRegistrationNumber:
      headerLine.length > 129 ? headerLine.substring(120, 128).trim() : undefined,
    partnershipCount:
      headerLine.length > 132 ? parseInt(headerLine.substring(128, 131).trim()) : undefined,
    partnershipProfitShare:
      headerLine.length > 138 ? parseFloat(headerLine.substring(131, 137).trim()) : undefined,
    currencyType:
      headerLine.length > 140
        ? (parseInt(headerLine.substring(137, 139).trim()) as CurrencyType)
        : CurrencyType.SHEKELS,
    auditOpinionType:
      headerLine.length > 142
        ? (parseInt(headerLine.substring(139, 141).trim()) as AuditOpinionType)
        : undefined,
    amountsInThousands:
      headerLine.length > 143 ? (parseInt(headerLine.charAt(141)) as YesNo) : YesNo.NO,
  };

  return header;
}
