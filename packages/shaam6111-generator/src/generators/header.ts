import { HeaderRecord } from '../types/header.js';

/**
 * Generates a fixed-width formatted string for a HeaderRecord.
 * @param header The HeaderRecord to format.
 * @returns A string formatted according to the SHAAM 6111 specification.
 */
export function generateHeaderRecord(header: HeaderRecord): string {
  const padOrTrim = (value: string, length: number, padChar = ' ', alignRight = false): string => {
    if (value.length > length) {
      return value.slice(0, length);
    }
    return alignRight ? value.padStart(length, padChar) : value.padEnd(length, padChar);
  };

  return (
    padOrTrim(header.taxFileNumber, 9) +
    padOrTrim(header.taxYear, 4) +
    padOrTrim(header.idNumber, 9) +
    padOrTrim(header.vatFileNumber ?? '', 9) +
    padOrTrim(header.withholdingTaxFileNumber ?? '', 9) +
    padOrTrim(header.industryCode, 4) +
    padOrTrim(header.businessDescription ?? '', 50, ' ', true) +
    padOrTrim(header.businessType.toString(), 1) +
    padOrTrim(header.reportingMethod.toString(), 1) +
    padOrTrim(header.accountingMethod.toString(), 1) +
    padOrTrim(header.accountingSystem.toString(), 1) +
    padOrTrim(header.isPartnership?.toString() ?? '', 1) +
    padOrTrim(header.includesProfitLoss.toString(), 1) +
    padOrTrim(header.includesTaxAdjustment.toString(), 1) +
    padOrTrim(header.includesBalanceSheet.toString(), 1) +
    padOrTrim(header.profitLossEntryCount?.toString() ?? '', 3, '0', true) +
    padOrTrim(header.taxAdjustmentEntryCount?.toString() ?? '', 3, '0', true) +
    padOrTrim(header.balanceSheetEntryCount?.toString() ?? '', 3, '0', true) +
    padOrTrim(header.ifrsImplementationYear ?? '', 4) +
    padOrTrim(header.ifrsReportingOption?.toString() ?? '', 1) +
    padOrTrim(header.softwareRegistrationNumber ?? '', 8) +
    padOrTrim(header.partnershipCount?.toString() ?? '', 3, '0', true) +
    padOrTrim(header.partnershipProfitShare?.toFixed(2).replace('.', '') ?? '', 6, '0', true) +
    padOrTrim(header.currencyType.toString(), 1) +
    padOrTrim(header.auditOpinionType?.toString() ?? '', 1) +
    padOrTrim(header.amountsInThousands.toString(), 1)
  );
}
