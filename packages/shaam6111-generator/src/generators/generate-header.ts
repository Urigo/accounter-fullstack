import { HeaderRecord } from '../types/header.js';
import { padOrTrim } from '../utils/generation-utils.js';

/**
 * Generates a fixed-width formatted string for a HeaderRecord.
 * @param header The HeaderRecord to format.
 * @returns A string formatted according to the SHAAM 6111 specification.
 */
export function generateHeaderRecord(header: HeaderRecord): string {
  return (
    padOrTrim(header.taxFileNumber, 9) +
    padOrTrim(header.taxYear, 4) +
    padOrTrim(header.idNumber, 9) +
    padOrTrim(header.vatFileNumber ?? '', 9) +
    padOrTrim(header.withholdingTaxFileNumber ?? '', 9) +
    padOrTrim(header.industryCode, 4) +
    padOrTrim(header.businessDescription ?? '', 50, ' ', false) +
    padOrTrim(header.businessType.toString(), 2, '0') +
    padOrTrim(header.reportingMethod.toString(), 2, '0') +
    padOrTrim(header.accountingMethod.toString(), 2, '0') +
    padOrTrim(header.accountingSystem.toString(), 2, '0') +
    padOrTrim(header.isPartnership?.toString() ?? '', 1) +
    padOrTrim(header.includesProfitLoss.toString(), 1) +
    padOrTrim(header.includesTaxAdjustment.toString(), 1) +
    padOrTrim(header.includesBalanceSheet.toString(), 1) +
    padOrTrim(header.profitLossEntryCount?.toString() ?? '', 3) +
    padOrTrim(header.taxAdjustmentEntryCount?.toString() ?? '', 3) +
    padOrTrim(header.balanceSheetEntryCount?.toString() ?? '', 3) +
    padOrTrim(header.ifrsImplementationYear ?? '9999', 4) +
    padOrTrim(header.ifrsReportingOption?.toString() ?? '', 1) +
    padOrTrim(header.softwareRegistrationNumber ?? '99999999', 8) +
    padOrTrim(header.partnershipCount?.toString() ?? '999', 3) +
    padOrTrim(header.partnershipProfitShare?.toFixed(2).replace('.', '') ?? '999999', 6) +
    padOrTrim(
      header.partnershipProfitShare
        ? header.partnershipProfitShare.toFixed(2).replace('.', '')
        : '999999',
      6,
    ) +
    padOrTrim(header.currencyType.toString(), 2) +
    padOrTrim(header.auditOpinionType?.toString() ?? '', 2) +
    padOrTrim(header.amountsInThousands.toString(), 1)
  );
}
