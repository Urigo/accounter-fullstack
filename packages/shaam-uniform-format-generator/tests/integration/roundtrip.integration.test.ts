/**
 * Integration test for round-trip generation and parsing
 * This test ensures that data can be generated to SHAAM format and parsed back correctly
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import {
  parseA100,
  parseB100,
  parseB110,
  parseC100,
  parseD110,
  parseD120,
  parseM100,
  parseZ900,
} from '../../src/generator/records/index';
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
          type: 'Asset',
          balance: 5000.0,
        },
        {
          id: '1200',
          name: 'Accounts Receivable',
          type: 'Asset',
          balance: 3000.0,
        },
        {
          id: '4000',
          name: 'Sales Revenue',
          type: 'Revenue',
          balance: 8000.0,
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

    // Split dataText into lines and parse each record
    const lines = result.dataText.split('\r\n').filter(line => line.trim().length > 0);

    interface ParsedData {
      businessMetadata: ReturnType<typeof parseA100> | null;
      documents: ReturnType<typeof parseC100>[];
      documentLines: ReturnType<typeof parseD110>[];
      payments: ReturnType<typeof parseD120>[];
      journalEntries: ReturnType<typeof parseB100>[];
      accounts: ReturnType<typeof parseB110>[];
      inventory: ReturnType<typeof parseM100>[];
      closingRecord: ReturnType<typeof parseZ900> | null;
    }

    const parsedData: ParsedData = {
      businessMetadata: null,
      documents: [],
      documentLines: [],
      payments: [],
      journalEntries: [],
      accounts: [],
      inventory: [],
      closingRecord: null,
    };

    // Parse each line based on record type
    for (const line of lines) {
      const recordType = line.substring(0, 4);

      switch (recordType) {
        case 'A100':
          parsedData.businessMetadata = parseA100(line);
          break;
        case 'C100':
          parsedData.documents.push(parseC100(line));
          break;
        case 'D110':
          parsedData.documentLines.push(parseD110(line));
          break;
        case 'D120':
          parsedData.payments.push(parseD120(line));
          break;
        case 'B100':
          parsedData.journalEntries.push(parseB100(line));
          break;
        case 'B110':
          parsedData.accounts.push(parseB110(line));
          break;
        case 'M100':
          parsedData.inventory.push(parseM100(line));
          break;
        case 'Z900':
          parsedData.closingRecord = parseZ900(line);
          break;
        default:
          // Unknown record type, skip silently for test purposes
          break;
      }
    }

    // Verify business metadata
    expect(parsedData.businessMetadata).toBeDefined();
    expect(parsedData.businessMetadata?.vatId).toBe(input.business.taxId);
    // primaryIdentifier is now auto-generated, so just verify it's a valid 15-digit string
    expect(parsedData.businessMetadata?.primaryIdentifier).toMatch(/^\d{15}$/);

    // Verify documents
    expect(parsedData.documents).toHaveLength(input.documents.length);
    for (let i = 0; i < input.documents.length; i++) {
      const original = input.documents[i];
      const parsed = parsedData.documents[i];
      expect(parsed.documentId).toBe(original.id);
      expect(parsed.documentType).toBe(original.type);
      expect(parsed.documentIssueDate).toBe(original.date.replace(/-/g, ''));
    }

    // Verify document lines
    expect(parsedData.documentLines).toHaveLength(input.documents.length);
    for (let i = 0; i < input.documents.length; i++) {
      const original = input.documents[i];
      const parsed = parsedData.documentLines[i];
      expect(parsed.documentNumber).toBe(original.id);
      expect(parsed.documentType).toBe(original.type);
      expect(parsed.goodsServiceDescription).toBe(original.description || 'Item');
    }

    // Verify payments
    expect(parsedData.payments).toHaveLength(input.documents.length);
    for (let i = 0; i < input.documents.length; i++) {
      const original = input.documents[i];
      const parsed = parsedData.payments[i];
      expect(parsed.documentNumber).toBe(original.id);
      expect(parsed.documentType).toBe(original.type);
      expect(parsed.lineAmount).toBe(original.amount.toFixed(2));
    }

    // Verify journal entries
    expect(parsedData.journalEntries).toHaveLength(input.journalEntries.length);
    for (let i = 0; i < input.journalEntries.length; i++) {
      const original = input.journalEntries[i];
      const parsed = parsedData.journalEntries[i];
      const expectedTransactionNumber =
        (original.id.replace(/\D/g, '') || '1').replace(/^0+/, '') || '0';
      expect(parsed.transactionNumber).toBe(expectedTransactionNumber); // Numeric part with leading zeros stripped
      expect(parsed.accountKey).toBe(original.accountId);
      expect(parsed.transactionAmount).toBe(Math.abs(original.amount).toFixed(2));
      expect(parsed.debitCreditIndicator).toBe(original.amount >= 0 ? '1' : '2');
    }

    // Verify accounts
    expect(parsedData.accounts).toHaveLength(input.accounts.length);
    for (let i = 0; i < input.accounts.length; i++) {
      const original = input.accounts[i];
      const parsed = parsedData.accounts[i];
      expect(parsed.accountKey).toBe(original.id);
      expect(parsed.accountName).toBe(original.name);
      expect(parsed.trialBalanceCode).toBe(original.type);
    }

    // Verify inventory
    expect(parsedData.inventory).toHaveLength(input.inventory.length);
    for (let i = 0; i < input.inventory.length; i++) {
      const original = input.inventory[i];
      const parsed = parsedData.inventory[i];
      expect(parsed.internalItemCode).toBe(original.id);
      expect(parsed.itemName).toBe(original.name);
      expect(parsed.totalStockOut).toBe(original.quantity.toString());
    }

    // Verify closing record
    expect(parsedData.closingRecord).toBeDefined();
    expect(parsedData.closingRecord?.vatId).toBe(input.business.taxId);
    // uniqueId is now auto-generated and should match the primaryIdentifier
    expect(parsedData.closingRecord?.uniqueId).toMatch(/^\d{15}$/);
    expect(parsedData.closingRecord?.uniqueId).toBe(parsedData.businessMetadata?.primaryIdentifier);
    expect(parseInt(parsedData.closingRecord?.totalRecords || '0')).toBeGreaterThan(0);

    // Verify summary record counts match parsed data
    const expectedTotalRecords =
      1 + // A000 (INI file)
      8 + // A000Sum records (one for each record type: A100, C100, D110, D120, B100, B110, M100, Z900)
      1 + // A100
      input.documents.length + // C100 records
      input.documents.length + // D110 records
      input.documents.length + // D120 records
      input.journalEntries.length + // B100 records
      input.accounts.length + // B110 records
      input.inventory.length + // M100 records
      1; // Z900

    expect(result.summary.totalRecords).toBe(expectedTotalRecords);
    expect(parseInt(parsedData.closingRecord?.totalRecords || '0')).toBe(expectedTotalRecords - 10); // Z900 counts data records only (excludes A000, A000Sum records, and Z900 itself)

    // Verify record type counts in summary
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

    const lines = result.dataText.split('\r\n').filter(line => line.trim().length > 0);
    expect(lines).toHaveLength(2);

    // Should have A100 and Z900 records only
    expect(lines[0].startsWith('A100')).toBe(true);
    expect(lines[1].startsWith('Z900')).toBe(true);

    // Parse and verify
    const businessRecord = parseA100(lines[0]);
    const closingRecord = parseZ900(lines[1]);

    expect(businessRecord.vatId).toBe(minimalInput.business.taxId);
    expect(closingRecord.vatId).toBe(minimalInput.business.taxId);
    expect(closingRecord.totalRecords).toBe('1'); // Only A100 counted
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
          type: 'Liability',
          balance: 123_456.78,
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
    const lines = result.dataText.split('\r\n').filter(line => line.trim().length > 0);

    // Find and parse the payment record for the high-value document
    const paymentLine = lines.find(line => line.startsWith('D120'));
    expect(paymentLine).toBeDefined();

    const paymentRecord = parseD120(paymentLine!);
    expect(paymentRecord.lineAmount).toBe('999999.99');

    // Find and parse the journal entry
    const journalLine = lines.find(line => line.startsWith('B100'));
    expect(journalLine).toBeDefined();

    const journalRecord = parseB100(journalLine!);
    expect(journalRecord.transactionAmount).toBe('123.45');
  });
});
