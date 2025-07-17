import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../src/index';

describe('INI.TXT Generation', () => {
  it('should generate iniText with A100 summary line for minimal business metadata', () => {
    // Minimal business metadata as specified in todo
    const input = {
      business: {
        businessId: 'minimal123',
        name: 'Minimal Test Company',
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

    // Basic assertions
    expect(result.iniText).toBeDefined();
    expect(typeof result.iniText).toBe('string');

    // Split INI text into lines
    const iniLines = result.iniText.split('\r\n').filter(line => line.trim().length > 0);

    // Should contain A000 header record
    const a000Line = iniLines.find(line => line.startsWith('A000'));
    expect(a000Line).toBeDefined();
    expect(a000Line).toContain(input.business.taxId);
    expect(a000Line).toContain(input.business.name);

    // Should contain A100 summary record (as requested in todo)
    const a100SummaryLine = iniLines.find(line => line.startsWith('A100') && line.length === 19);
    expect(a100SummaryLine).toBeDefined();
    expect(a100SummaryLine).toBe('A100000000000000001'); // A100 + 15-digit count (1)

    // Should contain other expected summary records
    // Only A100 and Z900 should be present for minimal input
    const actualSummaryRecords = iniLines
      .filter(line => line.length === 19 && !line.startsWith('A000'))
      .map(line => line.substring(0, 4));

    expect(actualSummaryRecords).toContain('A100');
    expect(actualSummaryRecords).toContain('Z900');

    // Total lines should be: A000 + A100 summary + Z900 summary = 3
    expect(iniLines.length).toBe(3);
  });

  it('should generate correct A100 summary count when there are records', () => {
    const input = {
      business: {
        businessId: 'test123',
        name: 'Test Company',
        taxId: '987654321',
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [
        {
          id: 'DOC001',
          type: '320' as const,
          date: '2024-03-15',
          amount: 1000.5,
          description: 'Test document',
        },
      ],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          description: 'Test journal entry',
          accountId: 'ACC001',
        },
      ],
      accounts: [
        {
          id: 'ACC001',
          name: 'Test Account',
          type: 'Asset',
          balance: 0,
        },
      ],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Test Item',
          quantity: 100,
          unitPrice: 10.0,
        },
      ],
    };

    const result = generateUniformFormatReport(input);
    const iniLines = result.iniText.split('\r\n').filter(line => line.trim().length > 0);

    // Check that all expected summary records are present with correct counts
    const summaryLines = iniLines.filter(line => line.length === 19 && !line.startsWith('A000'));

    // Expected: A100(1), C100(1), D110(1), D120(1), B100(1), B110(1), M100(1), Z900(1)
    expect(summaryLines).toHaveLength(8);

    // Verify specific counts
    expect(summaryLines).toContain('A100000000000000001'); // 1 A100 record
    expect(summaryLines).toContain('C100000000000000001'); // 1 C100 record
    expect(summaryLines).toContain('D110000000000000001'); // 1 D110 record
    expect(summaryLines).toContain('D120000000000000001'); // 1 D120 record
    expect(summaryLines).toContain('B100000000000000001'); // 1 B100 record
    expect(summaryLines).toContain('B110000000000000001'); // 1 B110 record
    expect(summaryLines).toContain('M100000000000000001'); // 1 M100 record
    expect(summaryLines).toContain('Z900000000000000001'); // 1 Z900 record
  });
});
