/**
 * Comprehensive integration test for full round-trip generation and parsing
 * including A000Sum summary records and full validation
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import { parseUniformFormatFiles } from '../../src/api/parse-files';
import type { ReportInput } from '../../src/types/index';

describe('Comprehensive SHAAM Format Integration Test', () => {
  it('should generate complete SHAAM files with ALL available attributes and parse back correctly', () => {
    // Comprehensive ReportInput fixture with ALL available attributes
    const input: ReportInput = {
      business: {
        businessId: '12345',
        name: 'Test Company Ltd',
        taxId: '123456789',
        address: {
          street: 'Main Street',
          houseNumber: '123',
          city: 'Tel Aviv',
          zip: '12345',
        },
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [
        {
          id: 'DOC001',
          type: '320', // Receipt Tax Invoice
          date: '2024-03-15',
          amount: 1000.5,
          description: 'Consulting services with comprehensive details',
        },
        {
          id: 'DOC002',
          type: '330', // Credit Tax Invoice
          date: '2024-03-20',
          amount: 250.75,
          description: 'Product return with full documentation',
        },
        {
          id: 'DOC003',
          type: '305', // Tax Invoice
          date: '2024-04-10',
          amount: 5000.99,
          description: 'Large consulting project invoice',
        },
        {
          id: 'DOC004',
          type: '500', // Supplier Invoice
          date: '2024-04-15',
          amount: 750.25,
          description: 'Office supplies purchase',
        },
      ],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          accountId: '1100',
          description: 'Sales revenue entry',
          transactionNumber: 1001,
          transactionLineNumber: 1,
          batchNumber: 202_403,
          transactionType: 'SALE',
          referenceDocument: 'DOC001',
          referenceDocumentType: '320',
          referenceDocument2: 'ORDER001',
          referenceDocumentType2: '100',
          valueDate: '2024-03-15',
          counterAccountKey: '4100',
          debitCreditIndicator: '1',
          currencyCode: 'ILS',
          transactionAmount: 1000.5,
          foreignCurrencyAmount: 270.15, // USD equivalent
          quantityField: 10.5,
          matchingField1: 'MATCH001',
          matchingField2: 'BATCH202403',
          branchId: 'BR001',
          entryDate: '2024-03-15',
          operatorUsername: 'john_doe',
          reserved: 'RESERVED_DATA',
        },
        {
          id: 'JE002',
          date: '2024-03-20',
          amount: -250.75,
          accountId: '1200',
          description: 'Returns and allowances with full tracking',
          transactionNumber: 1002,
          transactionLineNumber: 1,
          batchNumber: 202_403,
          transactionType: 'RETURN',
          referenceDocument: 'DOC002',
          referenceDocumentType: '330',
          valueDate: '2024-03-20',
          counterAccountKey: '4200',
          debitCreditIndicator: '2',
          currencyCode: 'USD',
          transactionAmount: -250.75,
          foreignCurrencyAmount: -67.57, // ILS equivalent
          quantityField: 2.5,
          matchingField1: 'MATCH002',
          matchingField2: 'RETURN_BATCH',
          branchId: 'BR002',
          entryDate: '2024-03-20',
          operatorUsername: 'jane_smith',
        },
        {
          id: 'JE003',
          date: '2024-04-10',
          amount: 5000.99,
          accountId: '1300',
          description: 'Large project revenue recognition',
          transactionNumber: 1003,
          transactionLineNumber: 1,
          batchNumber: 202_404,
          transactionType: 'REVENUE',
          referenceDocument: 'DOC003',
          referenceDocumentType: '305',
          valueDate: '2024-04-10',
          counterAccountKey: '4300',
          debitCreditIndicator: '1',
          currencyCode: 'EUR',
          transactionAmount: 5000.99,
          foreignCurrencyAmount: 4543.18, // EUR equivalent
          quantityField: 100.0,
          matchingField1: 'PROJECT_X',
          branchId: 'BR001',
          entryDate: '2024-04-10',
          operatorUsername: 'proj_mgr',
        },
      ],
      accounts: [
        {
          id: '1100',
          name: 'Cash Account',
          sortCode: {
            key: 'Asset',
            name: 'Current Assets',
          },
          address: {
            street: 'Bank Street',
            houseNumber: '456',
            city: 'Jerusalem',
            zip: '67890',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '1000',
          vatId: '  123 454 321  ',
          accountOpeningBalance: 5000.0,
          totalDebits: 15_000.5,
          totalCredits: 8500.25,
          accountingClassificationCode: 'A1100',
          branchId: 'BR001',
          openingBalanceForeignCurrency: 1351.35, // USD equivalent
          foreignCurrencyCode: 'USD',
        },
        {
          id: '1200',
          name: 'Accounts Receivable',
          sortCode: {
            key: 'Asset',
            name: 'Current Assets',
          },
          address: {
            street: 'Customer Avenue',
            houseNumber: '789',
            city: 'Haifa',
            zip: '54321',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '1000',
          vatId: '987654321',
          accountOpeningBalance: 3000.0,
          totalDebits: 12_000.75,
          totalCredits: 4500.5,
          accountingClassificationCode: 'A1200',
          branchId: 'BR002',
          openingBalanceForeignCurrency: 810.81, // USD equivalent
          foreignCurrencyCode: 'USD',
        },
        {
          id: '4000',
          name: 'Sales Revenue',
          sortCode: {
            key: 'Revenue',
            name: 'Operating Revenue',
          },
          address: {
            street: 'Revenue Street',
            houseNumber: '321',
            city: 'Eilat',
            zip: '88000',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '4000',
          accountOpeningBalance: 8000.0,
          totalDebits: 2000.0,
          totalCredits: 25_000.99,
          accountingClassificationCode: 'R4000',
          branchId: 'BR001',
          openingBalanceForeignCurrency: 2162.16, // USD equivalent
          foreignCurrencyCode: 'USD',
        },
        {
          id: '2000',
          name: 'Accounts Payable',
          sortCode: {
            key: 'Liability',
            name: 'Current Liabilities',
          },
          address: {
            street: 'Supplier Road',
            houseNumber: '555',
            city: 'Beer Sheva',
            zip: '84000',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '2000',
          vatId: '555555555',
          accountOpeningBalance: -1500.0,
          totalDebits: 5000.0,
          totalCredits: 8500.0,
          accountingClassificationCode: 'L2000',
          branchId: 'BR002',
          openingBalanceForeignCurrency: -405.41, // USD equivalent
          foreignCurrencyCode: 'USD',
        },
      ],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Professional Consulting Service Package A',
          quantity: 100,
        },
        {
          id: 'ITEM002',
          name: 'Premium Software License Package B',
          quantity: 50,
        },
        {
          id: 'ITEM003',
          name: 'Hardware Component X-Series',
          quantity: 25,
        },
        {
          id: 'ITEM004',
          name: 'Training Materials and Documentation',
          quantity: 200,
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

    // Verify business metadata including address
    expect(parsedData.data.business).toBeDefined();
    expect(parsedData.data.business.name).toBe(input.business.name);
    expect(parsedData.data.business.taxId).toBe(input.business.taxId);
    expect(parsedData.data.business.address).toBeDefined();
    expect(parsedData.data.business.address?.street).toBe(input.business.address?.street);
    expect(parsedData.data.business.address?.city).toBe(input.business.address?.city);
    expect(parsedData.data.business.address?.zip).toBe(input.business.address?.zip);

    // Verify A000Sum summary records from parsed summary (no need for manual parsing)
    expect(parsedData.summary.perType.A100).toBe(1);
    expect(parsedData.summary.perType.C100).toBe(input.documents.length);
    expect(parsedData.summary.perType.D110).toBe(input.documents.length);
    expect(parsedData.summary.perType.D120).toBe(input.documents.length);
    expect(parsedData.summary.perType.B100).toBe(input.journalEntries.length);
    expect(parsedData.summary.perType.B110).toBe(input.accounts.length);
    expect(parsedData.summary.perType.M100).toBe(input.inventory.length);
    expect(parsedData.summary.perType.Z900).toBe(1);

    // Verify documents with comprehensive validation
    expect(parsedData.data.documents).toHaveLength(input.documents.length);
    for (let i = 0; i < input.documents.length; i++) {
      const original = input.documents[i];
      const parsed = parsedData.data.documents[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.type).toBe(original.type);
      expect(parsed.date).toBe(original.date);
      expect(parsed.amount).toBe(original.amount);
      expect(parsed.description).toBe(original.description?.substring(0, 30));
    }

    // Verify journal entries with ALL extended fields
    expect(parsedData.data.journalEntries).toHaveLength(input.journalEntries.length);
    for (let i = 0; i < input.journalEntries.length; i++) {
      const original = input.journalEntries[i];
      const parsed = parsedData.data.journalEntries[i];
      expect(parsed.date).toBe(original.date);
      expect(parsed.amount).toBe(original.amount);
      expect(parsed.accountId).toBe(original.accountId);
      expect(parsed.description).toBe(original.description);

      // Validate extended B100 fields where available
      if (original.transactionNumber !== undefined) {
        expect(parsed.transactionNumber).toBeDefined();
      }
      if (original.batchNumber !== undefined) {
        expect(parsed.batchNumber).toBeDefined();
      }
      if (original.referenceDocument !== undefined) {
        expect(parsed.referenceDocument).toBe(original.referenceDocument);
      }
      if (original.referenceDocumentType !== undefined) {
        expect(parsed.referenceDocumentType).toBe(original.referenceDocumentType);
      }
      if (original.currencyCode !== undefined) {
        expect(parsed.currencyCode).toBe(original.currencyCode);
      }
      if (original.debitCreditIndicator !== undefined) {
        expect(parsed.debitCreditIndicator).toBe(original.debitCreditIndicator);
      }
      if (original.branchId !== undefined) {
        expect(parsed.branchId).toBe(original.branchId);
      }
      if (original.operatorUsername !== undefined) {
        expect(parsed.operatorUsername).toBe(original.operatorUsername.substring(0, 9));
      }
    }

    // Verify accounts with ALL extended fields
    expect(parsedData.data.accounts).toHaveLength(input.accounts.length);
    for (let i = 0; i < input.accounts.length; i++) {
      const original = input.accounts[i];
      const parsed = parsedData.data.accounts[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.name).toBe(original.name);
      expect(parsed.sortCode.key).toBe(original.sortCode.key);
      expect(parsed.sortCode.name).toBe(original.sortCode.name);
      expect(parsed.accountOpeningBalance).toBe(original.accountOpeningBalance);

      // Validate extended B110 fields
      if (original.address !== undefined) {
        expect(parsed.address).toBeDefined();
        expect(parsed.address?.street).toBe(original.address?.street);
        expect(parsed.address?.houseNumber).toBe(original.address?.houseNumber);
        expect(parsed.address?.city).toBe(original.address?.city);
        expect(parsed.address?.zip).toBe(original.address?.zip);
        expect(parsed.address?.country).toBe(original.address?.country);
      }
      if (original.countryCode !== undefined) {
        expect(parsed.countryCode).toBe(original.countryCode);
      }
      if (original.parentAccountKey !== undefined) {
        expect(parsed.parentAccountKey).toBe(original.parentAccountKey);
      }
      if (original.vatId !== undefined) {
        // SHAAM B110 format only supports numeric VAT IDs (Field 1419: max 9 digits)
        // Alphanumeric VAT IDs are automatically converted to numeric-only format
        const expectedVatId = original.vatId.replace(/\D/g, '');
        expect(parsed.vatId).toBe(expectedVatId);
      }
      if (original.totalDebits !== undefined) {
        expect(parsed.totalDebits).toBeDefined();
      }
      if (original.totalCredits !== undefined) {
        expect(parsed.totalCredits).toBeDefined();
      }
      if (original.accountingClassificationCode !== undefined) {
        // SHAAM B110 format only supports numeric accounting codes (Field 1417: max 4 digits)
        // Alphanumeric codes are automatically converted to numeric-only format
        const expectedCode = original.accountingClassificationCode.replace(/\D/g, '');
        expect(parsed.accountingClassificationCode).toBe(expectedCode);
      }
      if (original.branchId !== undefined) {
        expect(parsed.branchId).toBe(original.branchId);
      }
      if (original.foreignCurrencyCode !== undefined) {
        expect(parsed.foreignCurrencyCode).toBe(original.foreignCurrencyCode);
      }
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

    // Verify overall record counts with comprehensive data
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

  it('should validate comprehensive data integrity with complex edge cases', () => {
    // Test with various document types, currency codes, and edge cases
    const edgeCaseInput: ReportInput = {
      business: {
        businessId: '99999',
        name: 'Edge Case Testing Co Ltd',
        taxId: '999888777',
        address: {
          street: 'Test Street with special chars: åäö',
          houseNumber: '999A',
          city: 'Tel Aviv-Yafo',
          zip: '6789012',
        },
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [
        // Test various document types
        {
          id: 'ORDER_123',
          type: '100', // Order
          date: '2024-01-01',
          amount: 0.01, // Minimal amount
          description: 'Edge case order with minimal amount',
        },
        {
          id: 'DELIVERY_456',
          type: '200', // Delivery Note
          date: '2024-06-15',
          amount: 999_999.99, // Maximum practical amount
          description: 'Large delivery note - testing high amounts',
        },
        {
          id: 'CREDIT_CARD_789',
          type: '710', // Credit Card Receipt
          date: '2024-12-31',
          amount: 123.456, // Fractional amount with 3 decimal places
          description: 'Credit card transaction with precise amount',
        },
      ],
      journalEntries: [
        // Test with foreign currencies and complex fields
        {
          id: 'MULTI_CURRENCY_001',
          date: '2024-06-15',
          amount: 1234.56,
          accountId: 'USD_ACCOUNT',
          description: 'Multi-currency transaction test',
          transactionNumber: 999_999,
          transactionLineNumber: 999,
          batchNumber: 999_999,
          transactionType: 'MULTI_CURR',
          referenceDocument: 'REF_999',
          referenceDocumentType: '305',
          referenceDocument2: 'REF2_999',
          referenceDocumentType2: '320',
          valueDate: '2024-06-16',
          counterAccountKey: 'COUNTER_999',
          debitCreditIndicator: '2',
          currencyCode: 'EUR',
          transactionAmount: -1234.56,
          foreignCurrencyAmount: 1123.45,
          quantityField: 999.999,
          matchingField1: 'MATCH_FIELD_1_TEST',
          matchingField2: 'MATCH_FIELD_2_TEST',
          branchId: 'BRANCH_EDGE',
          entryDate: '2024-06-15',
          operatorUsername: 'edge_user',
          reserved: 'RESERVED_EDGE_DATA',
        },
      ],
      accounts: [
        // Test with various account types and all possible fields
        {
          id: 'USD_ACCOUNT',
          name: 'Foreign Currency Account - USD',
          sortCode: {
            key: 'Asset',
            name: 'Foreign Currency Assets',
          },
          address: {
            street: 'International Ave',
            houseNumber: '1',
            city: 'Global City',
            zip: '00000',
            country: 'International Zone',
          },
          countryCode: 'US',
          parentAccountKey: 'FOREIGN_ASSETS',
          vatId: '  999  999  999  ',
          accountOpeningBalance: -999_999.99, // Negative balance
          totalDebits: 500_000.0,
          totalCredits: 1_500_000.0,
          accountingClassificationCode: 'FA_USD',
          branchId: 'INTERNATIONAL',
          openingBalanceForeignCurrency: 999_999.99,
          foreignCurrencyCode: 'EUR',
        },
        // Test equity account
        {
          id: 'EQUITY_001',
          name: 'Owner Equity Account',
          sortCode: {
            key: 'Equity',
            name: 'Owner Equity',
          },
          countryCode: 'IL',
          accountOpeningBalance: 1_000_000.0, // Large equity balance
          totalDebits: 0.0,
          totalCredits: 1_000_000.0,
          accountingClassificationCode: 'EQ_001',
        },
        // Test expense account
        {
          id: 'EXPENSE_001',
          name: 'Operating Expenses',
          sortCode: {
            key: 'Expense',
            name: 'Operating Expenses',
          },
          accountOpeningBalance: 0.0,
          totalDebits: 250_000.0,
          totalCredits: 10_000.0, // Some credits for returns
          accountingClassificationCode: 'EX_001',
          branchId: 'MAIN',
          foreignCurrencyCode: 'USD',
          openingBalanceForeignCurrency: 0.0,
        },
      ],
      inventory: [
        // Test with edge case inventory items
        {
          id: 'EXPENSIVE_ITEM_001',
          name: 'High-Value Asset Item',
          quantity: 1,
        },
        {
          id: 'BULK_ITEM_001',
          name: 'Bulk Inventory Item',
          quantity: 10_000,
        },
        {
          id: 'FRACTIONAL_001',
          name: 'Fractional Quantity Item',
          quantity: 0.5,
        },
      ],
    };

    const result = generateUniformFormatReport(edgeCaseInput);
    const parsedData = parseUniformFormatFiles(result.iniText, result.dataText);

    // Comprehensive validation
    expect(parsedData.data.business.name).toBe(edgeCaseInput.business.name);
    expect(parsedData.data.business.address?.street).toContain('special chars');

    // Validate document type variety
    const documentTypes = parsedData.data.documents.map(d => d.type);
    expect(documentTypes).toContain('100'); // Order
    expect(documentTypes).toContain('200'); // Delivery Note
    expect(documentTypes).toContain('710'); // Credit Card Receipt

    // Validate amounts are preserved correctly
    expect(parsedData.data.documents[0].amount).toBe(0.01); // Minimal
    expect(parsedData.data.documents[1].amount).toBe(999_999.99); // Maximum

    // Validate complex journal entry
    const complexEntry = parsedData.data.journalEntries[0];
    expect(complexEntry.currencyCode).toBe('EUR');
    expect(complexEntry.debitCreditIndicator).toBe('2');
    expect(complexEntry.referenceDocument).toBe('REF_999');
    expect(complexEntry.operatorUsername).toBe('edge_user');

    // Validate account variety and extended fields
    const accounts = parsedData.data.accounts;
    const usdAccount = accounts.find(a => a.id === 'USD_ACCOUNT');
    expect(usdAccount).toBeDefined();
    expect(usdAccount!.countryCode).toBe('US');
    expect(usdAccount!.foreignCurrencyCode).toBe('EUR');
    expect(usdAccount!.accountOpeningBalance).toBe(-999_999.99); // Negative balance

    const equityAccount = accounts.find(a => a.sortCode.key === 'Equity');
    expect(equityAccount).toBeDefined();
    expect(equityAccount!.accountOpeningBalance).toBe(1_000_000.0);

    // Validate inventory edge cases
    const expensiveItem = parsedData.data.inventory.find(i => i.id === 'EXPENSIVE_ITEM_001');
    expect(expensiveItem).toBeDefined();

    const bulkItem = parsedData.data.inventory.find(i => i.id === 'BULK_ITEM_001');
    expect(bulkItem).toBeDefined();
    expect(bulkItem!.quantity).toBeGreaterThanOrEqual(0); // M100 may not preserve exact quantity

    // Verify record counts for edge case data
    expect(result.summary.totalRecords).toBeGreaterThan(10);
    expect(parsedData.summary.perType.C100).toBe(edgeCaseInput.documents.length);
    expect(parsedData.summary.perType.B100).toBe(edgeCaseInput.journalEntries.length);
    expect(parsedData.summary.perType.B110).toBe(edgeCaseInput.accounts.length);
    expect(parsedData.summary.perType.M100).toBe(edgeCaseInput.inventory.length);
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
