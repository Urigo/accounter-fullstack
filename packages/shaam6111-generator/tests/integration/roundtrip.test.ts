import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateReport } from '../../src/generators/generate-report';
import { parseReport } from '../../src/parsers/parse-report';
import { ReportData } from '../../src/types/index';
import { validReportData1 } from '../fixtures/validDataSets/data1';

describe('Roundtrip Tests', () => {
  describe('Data Fixture Roundtrip', () => {
    it('should maintain data integrity when generating a report and parsing it back', () => {
      // Generate a report from the fixture data
      const generatedReport = generateReport(validReportData1, false);

      // Parse the generated report back to data
      const parsedData = parseReport(generatedReport, false);

      // Check that the parsed data matches the original
      // Note: We need to normalize some fields for comparison because they might have
      // different string vs number representations or formatting differences

      // Header section comparison using a utility function
      const headerFields: Array<keyof ReportData['header']> = [
        'taxFileNumber',
        'taxYear',
        'idNumber',
        'industryCode',
        'businessType',
        'reportingMethod',
        'accountingMethod',
        'accountingSystem',
        'includesProfitLoss',
        'includesTaxAdjustment',
        'includesBalanceSheet',
      ];

      headerFields.map(field => {
        expect(parsedData.header[field]).toBe(validReportData1.header[field]);
      });

      // Helper function for comparing sections
      function compareSections(
        parsed: ReportData,
        original: ReportData,
        sectionName: 'profitAndLoss' | 'taxAdjustment' | 'balanceSheet',
      ) {
        expect(parsed[sectionName].length).toBe(original[sectionName].length);
        for (let i = 0; i < original[sectionName].length; i++) {
          expect(parsed[sectionName][i].code).toBe(original[sectionName][i].code);
          expect(parsed[sectionName][i].amount).toBe(original[sectionName][i].amount);
        }
      }

      // Profit and Loss section comparison
      compareSections(parsedData, validReportData1, 'profitAndLoss');

      // Tax Adjustment section comparison
      compareSections(parsedData, validReportData1, 'taxAdjustment');

      // Balance Sheet section comparison
      compareSections(parsedData, validReportData1, 'balanceSheet');

      // Entity type comparison
      expect(parsedData.individualOrCompany).toBe(validReportData1.individualOrCompany);
    });
  });

  describe('Report Fixture Roundtrip', () => {
    it('should maintain data integrity when parsing a report and generating it back', async () => {
      // Read the fixture report
      const reportFixturePath = path.join(
        __dirname,
        '..',
        'fixtures',
        'validReports',
        'report1.txt',
      );
      const originalReport = await readFile(reportFixturePath, 'utf-8');

      // Parse the report to data
      const parsedData = parseReport(originalReport, false);

      // Generate a new report from the parsed data
      const regeneratedReport = generateReport(parsedData, false);

      // The regenerated report should match the original report
      // Note: There might be some normalization differences, so we compare important sections

      // Compare the overall length
      expect(regeneratedReport.length).toBe(originalReport.length);

      // Check that key data points are preserved
      // Header section (first ~150 chars)
      expect(regeneratedReport.substring(0, 150)).toBe(originalReport.substring(0, 150));

      // Sample important fields from profit/loss, tax adjustment, and balance sheet
      // Check codes from different sections by their positions
      const checkPositions = [
        // Some positions where specific codes should appear
        513, // Start of profit/loss
        3213, // Start of tax adjustment
        5913, // Start of balance sheet
      ];

      for (const pos of checkPositions) {
        // Check 18-char segments at strategic positions
        expect(regeneratedReport.substring(pos, pos + 18)).toBe(
          originalReport.substring(pos, pos + 18),
        );
      }
    });
  });

  describe('End-to-End Data Preservation', () => {
    it('should preserve all significant data through multiple conversions', () => {
      // Start with the fixture data
      const originalData: ReportData = validReportData1;

      // Convert to report string
      const report = generateReport(originalData, false);

      // Convert back to data
      const firstPassData = parseReport(report, false);

      // Convert to report string again
      const secondReport = generateReport(firstPassData, false);

      // Convert back to data again
      const secondPassData = parseReport(secondReport, false);

      // After multiple conversions, the data should still match the original
      expect(secondPassData.header.taxFileNumber).toBe(originalData.header.taxFileNumber);
      expect(secondPassData.header.taxYear).toBe(originalData.header.taxYear);

      // Check that profit/loss codes and amounts are preserved
      expect(secondPassData.profitAndLoss.length).toBe(originalData.profitAndLoss.length);
      const originalCode6666 = originalData.profitAndLoss.find(entry => entry.code === 6666);
      const finalCode6666 = secondPassData.profitAndLoss.find(entry => entry.code === 6666);
      expect(originalCode6666).toBeDefined();
      expect(finalCode6666).toBeDefined();
      expect(finalCode6666?.amount).toBe(originalCode6666?.amount);

      // Check that tax adjustment codes and amounts are preserved
      const originalCode100 = originalData.taxAdjustment.find(entry => entry.code === 100);
      const finalCode100 = secondPassData.taxAdjustment.find(entry => entry.code === 100);
      expect(originalCode100).toBeDefined();
      expect(finalCode100).toBeDefined();
      expect(finalCode100?.amount).toBe(originalCode100?.amount);

      // Check that balance sheet codes and amounts are preserved
      const originalCode7800 = originalData.balanceSheet.find(entry => entry.code === 7800);
      const finalCode7800 = secondPassData.balanceSheet.find(entry => entry.code === 7800);
      expect(originalCode7800).toBeDefined();
      expect(finalCode7800).toBeDefined();
      expect(finalCode7800?.amount).toBe(originalCode7800?.amount);

      // Key validation values are preserved
      // Rule 3.7: The profit/loss code 6666 (net profit) must equal tax adjustment code 100 (adjusted income)
      expect(originalCode6666?.amount).toBe(originalCode100?.amount); // Rule 3.7
      expect(finalCode6666?.amount).toBe(finalCode100?.amount); // Rule 3.7 still holds

      // Rule 3.8: The sum of profit/loss codes 1450 (total assets) and 2095 (total liabilities)
      // must equal balance sheet code 7800 (total balance)
      const originalSum =
        (originalData.profitAndLoss.find(e => e.code === 1450)?.amount || 0) +
        (originalData.profitAndLoss.find(e => e.code === 2095)?.amount || 0);
      const finalSum =
        (secondPassData.profitAndLoss.find(e => e.code === 1450)?.amount || 0) +
        (secondPassData.profitAndLoss.find(e => e.code === 2095)?.amount || 0);

      expect(originalSum).toBe(originalCode7800?.amount);
      expect(finalSum).toBe(finalCode7800?.amount);
    });
  });
});
