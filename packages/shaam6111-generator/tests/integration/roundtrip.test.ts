import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateReportString } from '../../src/generators/generate-report';
import { parseReportString } from '../../src/parsers/parse-report';
import { ReportData } from '../../src/types/index';
import { validReportData1 } from '../fixtures/validDataSets/data1';

describe('Roundtrip Tests', () => {
  describe('Data Fixture Roundtrip', () => {
    it('should maintain data integrity when generating a report and parsing it back', () => {
      // Generate a report from the fixture data
      const generatedReport = generateReportString(validReportData1);

      // Parse the generated report back to data
      const parsedData = parseReportString(generatedReport);

      // Check that the parsed data matches the original
      // Note: We need to normalize some fields for comparison because they might have
      // different string vs number representations or formatting differences

      // Header section comparison
      expect(parsedData.header.taxFileNumber).toBe(validReportData1.header.taxFileNumber);
      expect(parsedData.header.taxYear).toBe(validReportData1.header.taxYear);
      expect(parsedData.header.idNumber).toBe(validReportData1.header.idNumber);
      expect(parsedData.header.industryCode).toBe(validReportData1.header.industryCode);
      expect(parsedData.header.businessType).toBe(validReportData1.header.businessType);
      expect(parsedData.header.reportingMethod).toBe(validReportData1.header.reportingMethod);
      expect(parsedData.header.accountingMethod).toBe(validReportData1.header.accountingMethod);
      expect(parsedData.header.accountingSystem).toBe(validReportData1.header.accountingSystem);
      expect(parsedData.header.includesProfitLoss).toBe(validReportData1.header.includesProfitLoss);
      expect(parsedData.header.includesTaxAdjustment).toBe(
        validReportData1.header.includesTaxAdjustment,
      );
      expect(parsedData.header.includesBalanceSheet).toBe(
        validReportData1.header.includesBalanceSheet,
      );

      // Profit and Loss section comparison
      expect(parsedData.profitAndLoss.length).toBe(validReportData1.profitAndLoss.length);
      for (let i = 0; i < validReportData1.profitAndLoss.length; i++) {
        expect(parsedData.profitAndLoss[i].code).toBe(validReportData1.profitAndLoss[i].code);
        expect(parsedData.profitAndLoss[i].amount).toBe(validReportData1.profitAndLoss[i].amount);
      }

      // Tax Adjustment section comparison
      expect(parsedData.taxAdjustment.length).toBe(validReportData1.taxAdjustment.length);
      for (let i = 0; i < validReportData1.taxAdjustment.length; i++) {
        expect(parsedData.taxAdjustment[i].code).toBe(validReportData1.taxAdjustment[i].code);
        expect(parsedData.taxAdjustment[i].amount).toBe(validReportData1.taxAdjustment[i].amount);
      }

      // Balance Sheet section comparison
      expect(parsedData.balanceSheet.length).toBe(validReportData1.balanceSheet.length);
      for (let i = 0; i < validReportData1.balanceSheet.length; i++) {
        expect(parsedData.balanceSheet[i].code).toBe(validReportData1.balanceSheet[i].code);
        expect(parsedData.balanceSheet[i].amount).toBe(validReportData1.balanceSheet[i].amount);
      }

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
      const parsedData = parseReportString(originalReport);

      // Generate a new report from the parsed data
      const regeneratedReport = generateReportString(parsedData);

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
      const report = generateReportString(originalData);

      // Convert back to data
      const firstPassData = parseReportString(report);

      // Convert to report string again
      const secondReport = generateReportString(firstPassData);

      // Convert back to data again
      const secondPassData = parseReportString(secondReport);

      // After multiple conversions, the data should still match the original
      expect(secondPassData.header.taxFileNumber).toBe(originalData.header.taxFileNumber);
      expect(secondPassData.header.taxYear).toBe(originalData.header.taxYear);

      // Check that profit/loss codes and amounts are preserved
      expect(secondPassData.profitAndLoss.length).toBe(originalData.profitAndLoss.length);
      const originalCode6666 = originalData.profitAndLoss.find(entry => entry.code === 6666);
      const finalCode6666 = secondPassData.profitAndLoss.find(entry => entry.code === 6666);
      expect(finalCode6666?.amount).toBe(originalCode6666?.amount);

      // Check that tax adjustment codes and amounts are preserved
      const originalCode100 = originalData.taxAdjustment.find(entry => entry.code === 100);
      const finalCode100 = secondPassData.taxAdjustment.find(entry => entry.code === 100);
      expect(finalCode100?.amount).toBe(originalCode100?.amount);

      // Check that balance sheet codes and amounts are preserved
      const originalCode7800 = originalData.balanceSheet.find(entry => entry.code === 7800);
      const finalCode7800 = secondPassData.balanceSheet.find(entry => entry.code === 7800);
      expect(finalCode7800?.amount).toBe(originalCode7800?.amount);

      // Key validation values are preserved
      expect(originalCode6666?.amount).toBe(originalCode100?.amount); // Rule 3.7
      expect(finalCode6666?.amount).toBe(finalCode100?.amount); // Rule 3.7 still holds

      // Rule 3.8 is preserved (1450 + 2095 = 7800)
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
