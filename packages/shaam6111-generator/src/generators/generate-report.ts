import { ValidationError } from '../types/index.js';
import { ReportData } from '../types/report-data.js';
import { validateData } from '../validation/index.js';
import { generateHeaderRecord } from './generate-header.js';
import { generateReportEntriesSection } from './generate-report-entries.js';

/**
 * Generates a full report string for the SHAAM 6111 specification.
 * @param reportData The ReportData object containing all sections of the report.
 * @returns A string formatted according to the SHAAM 6111 specification, 8612 characters long.
 */
export function generateReport(reportData: ReportData): string {
  // Validate the report data using the schema
  const validationResult = validateData(reportData);
  if (!validationResult.isValid) {
    throw new ValidationError('Validation failed', validationResult.errors);
  }

  // Generate the header section
  const headerSection = generateHeaderRecord(reportData.header);

  // Add the 370-long fixture
  const fixture = '0'.repeat(370);

  // Generate the profit and loss section
  const profitAndLossSection = generateReportEntriesSection(reportData.profitAndLoss);

  // Generate the tax adjustment section
  const taxAdjustmentSection = generateReportEntriesSection(reportData.taxAdjustment);

  // Generate the balance sheet section (if exists)
  const balanceSheetSection = reportData.balanceSheet
    ? generateReportEntriesSection(reportData.balanceSheet)
    : ''.padEnd(2700, '0');

  // Combine all sections into a single string
  const report =
    headerSection + fixture + profitAndLossSection + taxAdjustmentSection + balanceSheetSection;

  return report;
}
