import { IndividualOrCompanyEnum, ReportData, ValidationError } from '../types/index.js';
import { validateData } from '../validation/index.js';
import { parseHeaderRecord } from './parse-header.js';
import { parseReportEntries } from './parse-report-entries.js';

/**
 * Parses a SHAAM6111 report content string into a structured ReportData object
 * @param content - The raw content of the SHAAM6111 report
 * @returns A structured ReportData object
 */
export function parseReport(content: string): ReportData {
  // Remove any carriage returns and split by line breaks to work with individual lines
  const headerLine =
    content
      .replace(/\r/g, '')
      .split('\n')
      .find(line => line.trim().length > 0) ?? '';

  // Determine if this is an individual or company report based on required fields
  // For simplicity, we'll check if balance sheet is included with value 1 as an indicator for a company
  const isCompany = headerLine.length >= 107 && headerLine.charAt(106) === '1';

  // Parse header record
  const header = parseHeaderRecord(headerLine);

  // Get report entries for each section
  const profitAndLoss = parseReportEntries(content, 'profitAndLoss');
  const taxAdjustment = parseReportEntries(content, 'taxAdjustment');
  const balanceSheet = parseReportEntries(content, 'balanceSheet');

  // Construct the full report data
  const reportData: ReportData = {
    header,
    profitAndLoss,
    taxAdjustment,
    balanceSheet,
    individualOrCompany: isCompany
      ? IndividualOrCompanyEnum.COMPANY
      : IndividualOrCompanyEnum.INDIVIDUAL,
  };

  // Validate the report data using the schema
  const validationResult = validateData(reportData);
  if (!validationResult.isValid) {
    throw new ValidationError('Validation failed', validationResult.errors);
  }

  return reportData;
}
