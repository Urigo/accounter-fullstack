/**
 * Debug test to see the generated SHAAM format output
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../src/api/generate-report';
import type { ReportInput } from '../src/types/index';

describe('Debug SHAAM Format Output', () => {
  it('should show the generated INI and Data files', () => {
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
          name: 'Cash',
          sortCode: {
            key: 'Asset',
            name: 'Assets',
          },
          accountOpeningBalance: 5000.0,
        },
      ],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Product A',
          quantity: 100,
        },
      ],
    };

    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
  });
});
