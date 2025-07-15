import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../src/index';

describe('SHAAM Uniform Format Generator', () => {
  it('should generate a basic report', () => {
    const input = {
      business: {
        businessId: 'test123',
        name: 'Test Business',
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

    const result = generateUniformFormatReport(input);

    expect(result).toBeDefined();
    expect(result.iniText).toContain('A000');
    expect(result.dataText).toContain('A100');
    expect(result.summary.totalRecords).toBeGreaterThan(0);
  });
});
