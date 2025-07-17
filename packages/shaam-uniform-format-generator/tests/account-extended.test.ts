/**
 * Test for extended account schema with additional fields
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../src/api/generate-report';
import type { ReportInput } from '../src/types';

describe('Extended Account Schema', () => {
  it('should handle accounts with extended fields', () => {
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
      journalEntries: [],
      inventory: [],
      accounts: [
        {
          id: '4000',
          name: 'Revenue Account',
          sortCode: {
            key: '400',
            name: 'Revenue',
          },
          balance: 2000.0,
          countryCode: 'IL',
          accountOpeningBalance: 0.0,
          totalDebits: 500.0,
          totalCredits: 2500.0,
          accountingClassificationCode: '0001',
          branchId: 'MAIN',
          openingBalanceForeignCurrency: 1650.0,
          foreignCurrencyCode: 'USD',
        },
        {
          id: '1200',
          name: 'Basic Account',
          sortCode: {
            key: '120',
            name: 'Assets',
          },
          balance: 1500.0,
          // Optional fields can be omitted
        },
      ],
    };

    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
    expect(result.dataText).toContain('B110');
    expect(result.summary.perType.B110).toBe(2);

    // Check that the extended fields are properly encoded in the output
    expect(result.dataText).toContain('IL');
    expect(result.dataText).toContain('+00000000000000'); // accountOpeningBalance: 0.0
    expect(result.dataText).toContain('+00000000050000'); // totalDebits: 500.0
    expect(result.dataText).toContain('+00000000250000'); // totalCredits: 2500.0
    expect(result.dataText).toContain('0001');
    expect(result.dataText).toContain('MAIN');
    expect(result.dataText).toContain('+00000000165000'); // openingBalanceForeignCurrency: 1650.0
    expect(result.dataText).toContain('USD');
  });

  it('should work with accounts using only required fields', () => {
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
      journalEntries: [],
      inventory: [],
      accounts: [
        {
          id: '1100',
          name: 'Cash',
          sortCode: {
            key: '110',
            name: 'Cash Accounts',
          },
          balance: 5000.0,
        },
      ],
    };

    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
    expect(result.dataText).toContain('B110');
    expect(result.summary.perType.B110).toBe(1);
  });
});
