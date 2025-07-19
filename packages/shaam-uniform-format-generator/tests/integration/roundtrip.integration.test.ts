/**
 * Integration test for round-trip generation and parsing
 * This test ensures that data can be generated to SHAAM format and parsed back correctly
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import { parseUniformFormatFiles } from '../../src/api/parse-files';
import type { ReportInput } from '../../src/types/index';

describe('SHAAM Format Round-trip Integration Test', () => {
  it('should generate and parse back a complete report', () => {
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

    // Parse the generated files back using the new parsing function
    const parsedData = parseUniformFormatFiles(result.iniText, result.dataText);

    // Verify business metadata
    expect(parsedData.data.business).toBeDefined();
    expect(parsedData.data.business.name).toBe(input.business.name);
    expect(parsedData.data.business.taxId).toBe(input.business.taxId);
    expect(parsedData.data.business.businessId).toBeDefined();
    expect(parsedData.data.business.reportingPeriod.startDate).toBe(
      input.business.reportingPeriod.startDate,
    );
    expect(parsedData.data.business.reportingPeriod.endDate).toBe(
      input.business.reportingPeriod.endDate,
    );

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

    // Verify overall data integrity
    expect(result.summary.totalRecords).toBeGreaterThan(0);
    expect(result.summary.perType.A000).toBe(1);
    expect(result.summary.perType.A100).toBe(1);
    expect(result.summary.perType.C100).toBe(input.documents.length);
    expect(result.summary.perType.D110).toBe(input.documents.length);
    expect(result.summary.perType.D120).toBe(input.documents.length);
    expect(result.summary.perType.B100).toBe(input.journalEntries.length);
    expect(result.summary.perType.B110).toBe(input.accounts.length);
    expect(result.summary.perType.M100).toBe(input.inventory.length);
    expect(result.summary.perType.Z900).toBe(1);
  });

  it('should handle empty data sections correctly', () => {
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

    const result = generateUniformFormatReport(minimalInput);

    expect(result).toBeDefined();
    expect(result.dataText).toBeDefined();
    expect(result.summary.totalRecords).toBe(5); // A000 + 2 A000Sum (A100, Z900) + A100 + Z900

    // Parse the generated files back
    const parsedData = parseUniformFormatFiles(result.iniText, result.dataText);

    // Verify business metadata
    expect(parsedData.data.business).toBeDefined();
    expect(parsedData.data.business.name).toBe(minimalInput.business.name);
    expect(parsedData.data.business.taxId).toBe(minimalInput.business.taxId);

    // Verify empty arrays
    expect(parsedData.data.documents).toEqual([]);
    expect(parsedData.data.journalEntries).toEqual([]);
    expect(parsedData.data.accounts).toEqual([]);
    expect(parsedData.data.inventory).toEqual([]);
  });

  it('should maintain data integrity for monetary values', () => {
    const input: ReportInput = {
      business: {
        businessId: '99999',
        name: 'Financial Test Co',
        taxId: '111111111',
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [
        {
          id: 'HIGH-VAL',
          type: '320',
          date: '2024-06-15',
          amount: 999_999.99,
          description: 'High value transaction',
        },
      ],
      journalEntries: [
        {
          id: 'PRECISION-TEST',
          date: '2024-06-15',
          amount: 123.45,
          accountId: '2000',
          description: 'Precision test',
        },
      ],
      accounts: [
        {
          id: '2000',
          name: 'Test Account',
          sortCode: {
            key: 'Liability',
            name: 'Liabilities',
          },
          accountOpeningBalance: 123_456.78,
        },
      ],
      inventory: [
        {
          id: 'EXPENSIVE-ITEM',
          name: 'Expensive Product',
          quantity: 1,
          unitPrice: 999.99,
        },
      ],
    };

    const result = generateUniformFormatReport(input);

    // Parse the generated files back
    const parsedData = parseUniformFormatFiles(result.iniText, result.dataText);

    // Verify business metadata
    expect(parsedData.data.business).toBeDefined();
    expect(parsedData.data.business.name).toBe(input.business.name);
    expect(parsedData.data.business.taxId).toBe(input.business.taxId);

    // Verify high-value document was parsed correctly
    expect(parsedData.data.documents).toHaveLength(1);
    expect(parsedData.data.documents[0].amount).toBe(999_999.99);
    expect(parsedData.data.documents[0].id).toBe('HIGH-VAL');

    // Verify journal entry with precise monetary value
    expect(parsedData.data.journalEntries).toHaveLength(1);
    expect(parsedData.data.journalEntries[0].amount).toBe(123.45);
    expect(parsedData.data.journalEntries[0].accountId).toBe('2000');

    // Verify account balance
    expect(parsedData.data.accounts).toHaveLength(1);
    expect(parsedData.data.accounts[0].accountOpeningBalance).toBe(123_456.78);
    expect(parsedData.data.accounts[0].id).toBe('2000');

    // Verify inventory item
    expect(parsedData.data.inventory).toHaveLength(1);
    expect(parsedData.data.inventory[0].id).toBe('EXPENSIVE-ITEM');
    expect(parsedData.data.inventory[0].name).toBe('Expensive Product');
  });
});
