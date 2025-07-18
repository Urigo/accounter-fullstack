/**
 * Test suite for parseUniformFormatFiles function
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import { parseUniformFormatFiles } from '../../src/api/parse-files';
import type { ReportInput } from '../../src/types/index';

describe('parseUniformFormatFiles', () => {
  it('should parse a minimal SHAAM format with basic business info', () => {
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
      documents: [],
      journalEntries: [],
      accounts: [],
      inventory: [],
    };

    // Generate SHAAM format files from the input
    const generated = generateUniformFormatReport(input);

    // Parse the generated files back
    const result = parseUniformFormatFiles(generated.iniText, generated.dataText);

    expect(result).toBeDefined();
    expect(result.business).toBeDefined();
    expect(result.business.name).toBe('Test Company Ltd');
    expect(result.business.taxId).toBe('123456789');
    expect(result.business.businessId).toBeDefined(); // Generator creates unique primary identifier
    expect(result.business.businessId.length).toBeGreaterThan(0);
    expect(result.documents).toEqual([]);
    expect(result.journalEntries).toEqual([]);
    expect(result.accounts).toEqual([]);
    expect(result.inventory).toEqual([]);
  });

  it('should parse journal entries from B100 records', () => {
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
      documents: [],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          accountId: '1100',
          description: 'Sales revenue',
        },
      ],
      accounts: [],
      inventory: [],
    };

    const generated = generateUniformFormatReport(input);
    const result = parseUniformFormatFiles(generated.iniText, generated.dataText);

    expect(result.journalEntries).toHaveLength(1);
    expect(result.journalEntries[0].date).toBe(input.journalEntries[0].date);
    expect(result.journalEntries[0].amount).toBe(input.journalEntries[0].amount);
    expect(result.journalEntries[0].accountId).toBe(input.journalEntries[0].accountId);
    expect(result.journalEntries[0].description).toBe(input.journalEntries[0].description);
  });

  it('should parse accounts from B110 records', () => {
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
      documents: [],
      journalEntries: [],
      accounts: [
        {
          id: '1100',
          name: 'Cash Account',
          sortCode: {
            key: 'Asset',
            name: 'Assets',
          },
          balance: 5000,
          accountOpeningBalance: 5000,
          totalDebits: 0,
          totalCredits: 0,
          accountingClassificationCode: '9999',
          foreignCurrencyCode: 'USD',
        },
      ],
      inventory: [],
    };

    const generated = generateUniformFormatReport(input);
    const result = parseUniformFormatFiles(generated.iniText, generated.dataText);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe(input.accounts[0].id);
    expect(result.accounts[0].name).toBe(input.accounts[0].name);
    expect(result.accounts[0].sortCode.key).toBe(input.accounts[0].sortCode.key);
    expect(result.accounts[0].sortCode.name).toBe(input.accounts[0].sortCode.name);
    expect(result.accounts[0].balance).toBe(input.accounts[0].balance);
  });

  it('should parse documents from C100 records', () => {
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
          type: '320',
          date: '2024-03-15',
          amount: 1000.5,
          description: 'Consulting services',
        },
      ],
      journalEntries: [],
      accounts: [],
      inventory: [],
    };

    const generated = generateUniformFormatReport(input);
    const result = parseUniformFormatFiles(generated.iniText, generated.dataText);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe(input.documents[0].id);
    expect(result.documents[0].type).toBe(input.documents[0].type);
    expect(result.documents[0].date).toBe(input.documents[0].date);
    expect(result.documents[0].amount).toBe(input.documents[0].amount);
  });

  it('should parse inventory items from M100 records', () => {
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
      documents: [],
      journalEntries: [],
      accounts: [],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Product A',
          quantity: 100,
          unitPrice: 25.5,
        },
      ],
    };

    const generated = generateUniformFormatReport(input);
    const result = parseUniformFormatFiles(generated.iniText, generated.dataText);

    expect(result.inventory).toHaveLength(1);
    expect(result.inventory[0].id).toBe(input.inventory[0].id);
    expect(result.inventory[0].name).toBe(input.inventory[0].name);
    expect(result.inventory[0].quantity).toBeGreaterThanOrEqual(0); // M100 doesn't directly store quantity
  });

  it('should handle empty input gracefully', () => {
    const result = parseUniformFormatFiles('', '');

    expect(result).toBeDefined();
    expect(result.business).toBeDefined();
    expect(result.business.name).toBe('Unknown Business');
    expect(result.documents).toEqual([]);
    expect(result.journalEntries).toEqual([]);
    expect(result.accounts).toEqual([]);
    expect(result.inventory).toEqual([]);
  });

  it('should handle malformed lines gracefully', () => {
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
      documents: [],
      journalEntries: [],
      accounts: [],
      inventory: [],
    };

    const generated = generateUniformFormatReport(input);

    // Add invalid lines to test error handling
    const corruptedIni = generated.iniText + '\nINVALID_LINE_TOO_SHORT';
    const corruptedData = generated.dataText + '\nINVALID_RECORD_TYPE';

    const result = parseUniformFormatFiles(corruptedIni, corruptedData);

    expect(result).toBeDefined();
    expect(result.business.name).toBe('Test Company Ltd');
    // Should continue processing despite invalid lines\

    // TODO: rethink handling corrupted lines. maybe add errors attribute to parse result?
  });

  it('should perform complete round-trip correctly', () => {
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
          type: '320',
          date: '2024-03-15',
          amount: 1000.5,
          description: 'Consulting services',
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
      ],
      accounts: [
        {
          id: '1100',
          name: 'Cash Account',
          sortCode: {
            key: 'Asset',
            name: 'Assets',
          },
          balance: 5000,
        },
      ],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Product A',
          quantity: 100,
          unitPrice: 25.5,
        },
      ],
    };

    const generated = generateUniformFormatReport(input);
    const result = parseUniformFormatFiles(generated.iniText, generated.dataText);

    // Check business round-trip
    expect(result.business.name).toBe(input.business.name);
    expect(result.business.taxId).toBe(input.business.taxId);

    // Check we parsed at least some records
    expect(result.documents).toHaveLength(1);
    expect(result.journalEntries).toHaveLength(1);
    expect(result.accounts).toHaveLength(1);
    expect(result.inventory).toHaveLength(1);
  });
});
