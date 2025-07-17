/**
 * Comprehensive integration test for full round-trip generation and parsing
 * including A000Sum summary records and full validation
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import {
  parseA000,
  parseA000Sum,
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

    // Parse INI file
    const iniLines = result.iniText.split('\r\n').filter(line => line.trim().length > 0);

    interface ParsedIniData {
      headerRecord: ReturnType<typeof parseA000> | null;
      summaryRecords: ReturnType<typeof parseA000Sum>[];
    }

    const parsedIni: ParsedIniData = {
      headerRecord: null,
      summaryRecords: [],
    };

    // Parse INI file records
    for (const line of iniLines) {
      const recordType = line.substring(0, 4);

      if (recordType === 'A000') {
        parsedIni.headerRecord = parseA000(line);
      } else if (line.length === 19) {
        // A000Sum records are 19 characters long (4-char code + 15-char count)
        // They start with record type codes like A100, B100, C100, etc.
        try {
          const summaryRecord = parseA000Sum(line);
          parsedIni.summaryRecords.push(summaryRecord);
        } catch {
          // If parsing fails, it's not an A000Sum record
        }
      }
    }

    // Verify A000 header record
    expect(parsedIni.headerRecord).toBeDefined();
    expect(parsedIni.headerRecord?.vatId).toBe(input.business.taxId);
    expect(parsedIni.headerRecord?.businessName).toBe(input.business.name);

    // Verify A000Sum summary records
    expect(parsedIni.summaryRecords.length).toBe(8); // One for each record type

    const summaryByType = Object.fromEntries(
      parsedIni.summaryRecords.map(record => [record.code, parseInt(record.recordCount)]),
    );

    expect(summaryByType.A100).toBe(1);
    expect(summaryByType.C100).toBe(input.documents.length);
    expect(summaryByType.D110).toBe(input.documents.length);
    expect(summaryByType.D120).toBe(input.documents.length);
    expect(summaryByType.B100).toBe(input.journalEntries.length);
    expect(summaryByType.B110).toBe(input.accounts.length);
    expect(summaryByType.M100).toBe(input.inventory.length);
    expect(summaryByType.Z900).toBe(1);

    // Parse data file
    const dataLines = result.dataText.split('\r\n').filter(line => line.trim().length > 0);

    interface ParsedDataFile {
      businessMetadata: ReturnType<typeof parseA100> | null;
      documents: ReturnType<typeof parseC100>[];
      documentLines: ReturnType<typeof parseD110>[];
      payments: ReturnType<typeof parseD120>[];
      journalEntries: ReturnType<typeof parseB100>[];
      accounts: ReturnType<typeof parseB110>[];
      inventory: ReturnType<typeof parseM100>[];
      closingRecord: ReturnType<typeof parseZ900> | null;
    }

    const parsedData: ParsedDataFile = {
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
    for (const line of dataLines) {
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
      expect(parsed.transactionNumber).toBe(expectedTransactionNumber);
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
    expect(parseInt(parsedData.closingRecord?.totalRecords || '0')).toBeGreaterThan(0);

    // Cross-verify: Summary record counts should match actual parsed data counts
    expect(summaryByType.A100).toBe(parsedData.businessMetadata ? 1 : 0);
    expect(summaryByType.C100).toBe(parsedData.documents.length);
    expect(summaryByType.D110).toBe(parsedData.documentLines.length);
    expect(summaryByType.D120).toBe(parsedData.payments.length);
    expect(summaryByType.B100).toBe(parsedData.journalEntries.length);
    expect(summaryByType.B110).toBe(parsedData.accounts.length);
    expect(summaryByType.M100).toBe(parsedData.inventory.length);
    expect(summaryByType.Z900).toBe(parsedData.closingRecord ? 1 : 0);

    // Verify that Z900 total records matches data records count (excludes INI records)
    const dataRecordsCount =
      1 + // A100
      parsedData.documents.length + // C100
      parsedData.documentLines.length + // D110
      parsedData.payments.length + // D120
      parsedData.journalEntries.length + // B100
      parsedData.accounts.length + // B110
      parsedData.inventory.length; // M100
    // Z900 doesn't count itself

    expect(parseInt(parsedData.closingRecord?.totalRecords || '0')).toBe(dataRecordsCount);
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
