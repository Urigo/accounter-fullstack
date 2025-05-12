import { IndividualOrCompanyEnum, ReportData, ValidationError } from '../types/index.js';
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

  if (!headerLine || headerLine.length !== 8612) {
    throw new ValidationError('Validation failed: Header line is missing or has incorrect length.');
  }

  // Determine if this is an individual or company report based on required fields
  // For simplicity, we'll check if balance sheet is included with value 1 as an indicator for a company
  const isIndividual =
    parseInt(headerLine.substring(112, 115).trim()) === 0 && parseInt(headerLine.charAt(105)) === 2; // TODO: enhance this check

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
    individualOrCompany: isIndividual
      ? IndividualOrCompanyEnum.INDIVIDUAL
      : IndividualOrCompanyEnum.COMPANY,
  };

  return reportData;
}
