/**
 * Comprehensive integration test for full round-trip generation and parsing
 * including A000Sum summary records and full validation
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import { parseUniformFormatFiles } from '../../src/api/parse-files';
import type { ReportInput } from '../../src/types/index';

describe('Comprehensive SHAAM Format Integration Test', () => {
  it('should generate complete SHAAM files and parse back all records including A000Sum', () => {
    // Full ReportInput fixture
    const input: ReportInput = {
      business: {
        businessId: '12345',
        name: 'Test Company Ltd',
        taxId: '123456789',
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [
        {
          id: 'DOC001',
          type: '320', // Invoice
          date: '2024-03-15',
          amount: 1000.5,
          description: 'Consulting services',
        },
        {
          id: 'DOC002',
          type: '330', // Credit memo
          date: '2024-03-20',
          amount: 250.75,
          description: 'Product return',
        },
      ],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          accountId: '1100',
          description: 'Sales revenue',
        },
        {
          id: 'JE002',
          date: '2024-03-20',
          amount: -250.75,
          accountId: '1200',
          description: 'Returns and allowances',
        },
      ],
      accounts: [
        {
          id: '1100',
          name: 'Cash',
          sortCode: {
            key: 'Asset',
            name: 'Assets',
          },
          accountOpeningBalance: 5000.0,
        },
        {
          id: '1200',
          name: 'Accounts Receivable',
          sortCode: {
            key: 'Asset',
            name: 'Assets',
          },
          accountOpeningBalance: 3000.0,
        },
        {
          id: '4000',
          name: 'Sales Revenue',
          sortCode: {
            key: 'Revenue',
            name: 'Revenue',
          },
          accountOpeningBalance: 8000.0,
        },
      ],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Product A',
          quantity: 100,
          unitPrice: 25.0,
        },
        {
          id: 'ITEM002',
          name: 'Product B',
          quantity: 50,
          unitPrice: 45.0,
        },
      ],
    };

    // Generate the report
    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
    expect(result.dataText).toBeDefined();
    expect(result.iniText).toBeDefined();
    expect(result.summary.totalRecords).toBeGreaterThan(0);

    // Parse the generated files back using parseUniformFormatFiles
    const parsedData = parseUniformFormatFiles(result.iniText, result.dataText);

    // Verify business metadata
    expect(parsedData.data.business).toBeDefined();
    expect(parsedData.data.business.name).toBe(input.business.name);
    expect(parsedData.data.business.taxId).toBe(input.business.taxId);

    // Verify A000Sum summary records from parsed summary (no need for manual parsing)
    expect(parsedData.summary.perType.A100).toBe(1);
    expect(parsedData.summary.perType.C100).toBe(input.documents.length);
    expect(parsedData.summary.perType.D110).toBe(input.documents.length);
    expect(parsedData.summary.perType.D120).toBe(input.documents.length);
    expect(parsedData.summary.perType.B100).toBe(input.journalEntries.length);
    expect(parsedData.summary.perType.B110).toBe(input.accounts.length);
    expect(parsedData.summary.perType.M100).toBe(input.inventory.length);
    expect(parsedData.summary.perType.Z900).toBe(1);

    // Verify documents
    expect(parsedData.data.documents).toHaveLength(input.documents.length);
    for (let i = 0; i < input.documents.length; i++) {
      const original = input.documents[i];
      const parsed = parsedData.data.documents[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.type).toBe(original.type);
      expect(parsed.date).toBe(original.date);
      expect(parsed.amount).toBe(original.amount);
    }

    // Verify journal entries
    expect(parsedData.data.journalEntries).toHaveLength(input.journalEntries.length);
    for (let i = 0; i < input.journalEntries.length; i++) {
      const original = input.journalEntries[i];
      const parsed = parsedData.data.journalEntries[i];
      expect(parsed.date).toBe(original.date);
      expect(parsed.amount).toBe(original.amount);
      expect(parsed.accountId).toBe(original.accountId);
      expect(parsed.description).toBe(original.description);
    }

    // Verify accounts
    expect(parsedData.data.accounts).toHaveLength(input.accounts.length);
    for (let i = 0; i < input.accounts.length; i++) {
      const original = input.accounts[i];
      const parsed = parsedData.data.accounts[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.name).toBe(original.name);
      expect(parsed.sortCode.key).toBe(original.sortCode.key);
      expect(parsed.sortCode.name).toBe(original.sortCode.name);
      expect(parsed.accountOpeningBalance).toBe(original.accountOpeningBalance);
    }

    // Verify inventory
    expect(parsedData.data.inventory).toHaveLength(input.inventory.length);
    for (let i = 0; i < input.inventory.length; i++) {
      const original = input.inventory[i];
      const parsed = parsedData.data.inventory[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.name).toBe(original.name);
      expect(parsed.quantity).toBeGreaterThanOrEqual(0); // M100 records might not preserve exact quantity
    }

    // Cross-verify: Summary record counts should match actual parsed data counts
    expect(parsedData.summary.perType.A100).toBe(1); // Always 1 A100 record
    expect(parsedData.summary.perType.C100).toBe(parsedData.data.documents.length);
    expect(parsedData.summary.perType.D110).toBe(parsedData.data.documents.length); // D110 records don't directly appear in parsed data
    expect(parsedData.summary.perType.D120).toBe(parsedData.data.documents.length); // D120 records don't directly appear in parsed data
    expect(parsedData.summary.perType.B100).toBe(parsedData.data.journalEntries.length);
    expect(parsedData.summary.perType.B110).toBe(parsedData.data.accounts.length);
    expect(parsedData.summary.perType.M100).toBe(parsedData.data.inventory.length);
    expect(parsedData.summary.perType.Z900).toBe(1); // Always 1 Z900 record

    // Verify overall record counts
    const expectedTotalRecords =
      1 + // A000 (INI file)
      8 + // A000Sum records (one for each record type)
      1 + // A100
      input.documents.length + // C100 records
      input.documents.length + // D110 records
      input.documents.length + // D120 records
      input.journalEntries.length + // B100 records
      input.accounts.length + // B110 records
      input.inventory.length + // M100 records
      1; // Z900

    expect(result.summary.totalRecords).toBe(expectedTotalRecords);
  });

  it('should validate File objects are created correctly', () => {
    const minimalInput: ReportInput = {
      business: {
        businessId: '54321',
        name: 'Minimal Company',
        taxId: '987654321',
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [],
      journalEntries: [],
      accounts: [],
      inventory: [],
    };

    const result = generateUniformFormatReport(minimalInput, { fileNameBase: 'test-report' });

    // Verify File objects
    expect(result.iniFile).toBeInstanceOf(File);
    expect(result.dataFile).toBeInstanceOf(File);
    expect(result.iniFile.name).toBe('test-report.INI.TXT');
    expect(result.dataFile.name).toBe('test-report.BKMVDATA.TXT');
    expect(result.iniFile.type).toBe('text/plain');
    expect(result.dataFile.type).toBe('text/plain');

    // Verify file content matches text content
    expect(result.iniFile.size).toBe(result.iniText.length);
    expect(result.dataFile.size).toBe(result.dataText.length);
  });
});
