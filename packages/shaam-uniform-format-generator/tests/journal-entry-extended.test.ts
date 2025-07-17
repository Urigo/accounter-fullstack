/**
 * Test for extended journal entry schema with additional fields
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../src/api/generate-report';
import type { ReportInput } from '../src/types';

describe('Extended Journal Entry Schema', () => {
  it('should handle journal entries with extended fields', () => {
    const input: ReportInput = {
      business: {
        businessId: 'BIZ001',
        name: 'Test Business Ltd',
        taxId: '123456789',
        address: {
          street: 'Main St',
          houseNumber: '123',
          city: 'Tel Aviv',
          zip: '12345',
        },
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [],
      accounts: [
        {
          id: '1100',
          name: 'Cash',
          type: 'Asset',
          balance: 5000.0,
        },
      ],
      inventory: [],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          accountId: '1100',
          description: 'Sales revenue',
          batchNumber: 'BATCH001',
          transactionType: 'SALE',
          referenceDocument: 'INV-001',
          currencyCode: 'USD',
          foreignCurrencyAmount: 850.25,
        },
        {
          id: 'JE002',
          date: '2024-03-20',
          amount: -250.75,
          accountId: '1100',
          description: 'Returns and allowances',
          // Optional fields can be omitted
        },
      ],
    };

    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
    expect(result.dataText).toContain('B100');
    expect(result.summary.perType.B100).toBe(2);

    // Check that the extended fields are properly encoded in the output
    expect(result.dataText).toContain('BATCH001');
    expect(result.dataText).toContain('SALE');
    expect(result.dataText).toContain('INV-001');
    expect(result.dataText).toContain('USD');
    expect(result.dataText).toContain('850.25');
  });

  it('should work with journal entries using only required fields', () => {
    const input: ReportInput = {
      business: {
        businessId: 'BIZ001',
        name: 'Test Business Ltd',
        taxId: '123456789',
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [],
      accounts: [
        {
          id: '1100',
          name: 'Cash',
          type: 'Asset',
          balance: 5000.0,
        },
      ],
      inventory: [],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          accountId: '1100',
          description: 'Basic entry',
        },
      ],
    };

    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
    expect(result.dataText).toContain('B100');
    expect(result.summary.perType.B100).toBe(1);
  });
});
