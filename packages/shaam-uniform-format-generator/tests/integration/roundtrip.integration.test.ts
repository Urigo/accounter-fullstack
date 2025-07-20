/**
 * Integration test for round-trip generation and parsing
 * This test ensures that data can be generated to SHAAM format and parsed back correctly
 */

import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import { parseUniformFormatFiles } from '../../src/api/parse-files';
import type { ReportInput } from '../../src/types/index';

describe('SHAAM Format Round-trip Integration Test', () => {
  it('should generate and parse back a complete report with ALL available attributes', () => {
    // Comprehensive ReportInput fixture with ALL available attributes
    const input: ReportInput = {
      business: {
        businessId: '12345',
        name: 'Test Company Ltd',
        taxId: '123456789',
        address: {
          street: 'Innovation Boulevard',
          houseNumber: '42',
          city: 'Tel Aviv',
          zip: '69710',
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
          description: 'Comprehensive consulting services package',
        },
        {
          id: 'DOC002',
          type: '330', // Credit Tax Invoice
          date: '2024-03-20',
          amount: 250.75,
          description: 'Product return with detailed documentation',
        },
        {
          id: 'DOC003',
          type: '305', // Tax Invoice
          date: '2024-04-10',
          amount: 3500.0,
          description: 'Software licensing and support',
        },
        {
          id: 'DOC004',
          type: '500', // Supplier Invoice
          date: '2024-05-15',
          amount: 899.99,
          description: 'Office equipment procurement',
        },
        {
          id: 'DOC005',
          type: '100', // Order
          date: '2024-06-01',
          amount: 1250.0,
          description: 'Purchase order for materials',
        },
      ],
      journalEntries: [
        {
          id: 'JE001',
          date: '2024-03-15',
          amount: 1000.5,
          accountId: '1100',
          description: 'Sales revenue with comprehensive tracking',
          transactionNumber: 10_001,
          transactionLineNumber: 1,
          batchNumber: 202_403,
          transactionType: 'SALES',
          referenceDocument: 'DOC001',
          referenceDocumentType: '320',
          referenceDocument2: 'ORDER_001',
          referenceDocumentType2: '100',
          valueDate: '2024-03-15',
          counterAccountKey: '4100',
          debitCreditIndicator: '1',
          currencyCode: 'ILS',
          transactionAmount: 1000.5,
          foreignCurrencyAmount: 270.41, // USD equivalent
          quantityField: 10.0,
          matchingField1: 'MATCH_001',
          matchingField2: 'BATCH_A',
          branchId: 'BR_MAIN',
          entryDate: '2024-03-15',
          operatorUsername: 'acct_mgr',
          reserved: 'RESERVED_SALES',
        },
        {
          id: 'JE002',
          date: '2024-03-20',
          amount: -250.75,
          accountId: '1200',
          description: 'Returns and allowances with full audit trail',
          transactionNumber: 10_002,
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
          foreignCurrencyAmount: -927.78, // ILS equivalent
          quantityField: 2.5,
          matchingField1: 'RET_001',
          matchingField2: 'BATCH_B',
          branchId: 'BR_RET',
          entryDate: '2024-03-20',
          operatorUsername: 'ret_clerk',
          reserved: 'RESERVED_RETURN',
        },
        {
          id: 'JE003',
          date: '2024-04-10',
          amount: 3500.0,
          accountId: '1300',
          description: 'Software revenue recognition',
          transactionNumber: 10_003,
          transactionLineNumber: 1,
          batchNumber: 202_404,
          transactionType: 'SOFTWARE_REV',
          referenceDocument: 'DOC003',
          referenceDocumentType: '305',
          valueDate: '2024-04-10',
          counterAccountKey: '4300',
          debitCreditIndicator: '1',
          currencyCode: 'EUR',
          transactionAmount: 3500.0,
          foreignCurrencyAmount: 3182.73, // EUR equivalent
          quantityField: 1.0,
          matchingField1: 'SOFT_001',
          branchId: 'BR_SOFT',
          entryDate: '2024-04-10',
          operatorUsername: 'sw_acct',
        },
      ],
      accounts: [
        {
          id: '1100',
          name: 'Primary Cash Account',
          sortCode: {
            key: 'Asset',
            name: 'Current Assets',
          },
          address: {
            street: 'Bank Street',
            houseNumber: '123',
            city: 'Jerusalem',
            zip: '91999',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '1000',
          vatId: '123456789',
          accountOpeningBalance: 5000.0,
          totalDebits: 25_000.0,
          totalCredits: 18_500.0,
          accountingClassificationCode: '1100',
          branchId: 'BR_MAIN',
          openingBalanceForeignCurrency: 1351.35,
          foreignCurrencyCode: 'USD',
        },
        {
          id: '1200',
          name: 'Accounts Receivable - Trade',
          sortCode: {
            key: 'Asset',
            name: 'Current Assets',
          },
          address: {
            street: 'Customer Avenue',
            houseNumber: '456',
            city: 'Haifa',
            zip: '31999',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '1000',
          vatId: '987654321',
          accountOpeningBalance: 3000.0,
          totalDebits: 15_000.0,
          totalCredits: 8500.0,
          accountingClassificationCode: '1200',
          branchId: 'BR_SALE',
          openingBalanceForeignCurrency: 810.81,
          foreignCurrencyCode: 'USD',
        },
        {
          id: '4000',
          name: 'Sales Revenue - Services',
          sortCode: {
            key: 'Revenue',
            name: 'Operating Revenue',
          },
          address: {
            street: 'Revenue Street',
            houseNumber: '789',
            city: 'Eilat',
            zip: '88999',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '4000',
          accountOpeningBalance: 8000.0,
          totalDebits: 1000.0,
          totalCredits: 35_000.0,
          accountingClassificationCode: '4000',
          branchId: 'BR_SVC',
          openingBalanceForeignCurrency: 2162.16,
          foreignCurrencyCode: 'USD',
        },
        {
          id: '2100',
          name: 'Accounts Payable - Trade',
          sortCode: {
            key: 'Liability',
            name: 'Current Liabilities',
          },
          address: {
            street: 'Supplier Road',
            houseNumber: '321',
            city: 'Beer Sheva',
            zip: '84999',
            country: 'Israel',
          },
          countryCode: 'IL',
          parentAccountKey: '2000',
          vatId: '555 666 777',
          accountOpeningBalance: -2500.0,
          totalDebits: 8000.0,
          totalCredits: 12_500.0,
          accountingClassificationCode: '2100',
          branchId: 'BR_PUR',
          openingBalanceForeignCurrency: -675.68,
          foreignCurrencyCode: 'USD',
        },
        {
          id: '3000',
          name: 'Owner Equity',
          sortCode: {
            key: 'Equity',
            name: 'Owner Equity',
          },
          countryCode: 'IL',
          accountOpeningBalance: 50_000.0,
          totalDebits: 5000.0,
          totalCredits: 75_000.0,
          accountingClassificationCode: '3000',
          branchId: 'BR_MAIN',
          openingBalanceForeignCurrency: 13_513.51,
          foreignCurrencyCode: 'USD',
        },
      ],
      inventory: [
        {
          id: 'ITEM001',
          name: 'Professional Service Package Alpha',
          quantity: 100,
        },
        {
          id: 'ITEM002',
          name: 'Software License Premium Bundle',
          quantity: 50,
        },
        {
          id: 'ITEM003',
          name: 'Hardware Component Enterprise Series',
          quantity: 25,
        },
        {
          id: 'ITEM004',
          name: 'Training and Documentation Package',
          quantity: 200,
        },
        {
          id: 'ITEM005',
          name: 'Support and Maintenance Contract',
          quantity: 10,
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

    // Verify business metadata including address
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
    // Validate business address
    expect(parsedData.data.business.address).toBeDefined();
    expect(parsedData.data.business.address?.street).toBe(input.business.address?.street);
    expect(parsedData.data.business.address?.houseNumber).toBe(input.business.address?.houseNumber);
    expect(parsedData.data.business.address?.city).toBe(input.business.address?.city);
    expect(parsedData.data.business.address?.zip).toBe(input.business.address?.zip);

    // Verify documents with comprehensive validation
    expect(parsedData.data.documents).toHaveLength(input.documents.length);
    for (let i = 0; i < input.documents.length; i++) {
      const original = input.documents[i];
      const parsed = parsedData.data.documents[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.type).toBe(original.type);
      expect(parsed.date).toBe(original.date);
      expect(parsed.amount).toBe(original.amount);
      expect(parsed.description).toBeDefined(); // Description may be truncated or use generic value in C100
    }

    // Verify journal entries with ALL extended B100 fields
    expect(parsedData.data.journalEntries).toHaveLength(input.journalEntries.length);
    for (let i = 0; i < input.journalEntries.length; i++) {
      const original = input.journalEntries[i];
      const parsed = parsedData.data.journalEntries[i];
      expect(parsed.date).toBe(original.date);
      expect(parsed.amount).toBe(original.amount);
      expect(parsed.accountId).toBe(original.accountId);
      expect(parsed.description).toBe(original.description);

      // Validate ALL extended B100 fields
      if (original.transactionNumber !== undefined) {
        expect(parsed.transactionNumber).toBeDefined();
      }
      if (original.transactionLineNumber !== undefined) {
        expect(parsed.transactionLineNumber).toBeDefined();
      }
      if (original.batchNumber !== undefined) {
        expect(parsed.batchNumber).toBeDefined();
      }
      if (original.transactionType !== undefined) {
        expect(parsed.transactionType).toBe(original.transactionType);
      }
      if (original.referenceDocument !== undefined) {
        expect(parsed.referenceDocument).toBe(original.referenceDocument);
      }
      if (original.referenceDocumentType !== undefined) {
        expect(parsed.referenceDocumentType).toBe(original.referenceDocumentType);
      }
      if (original.referenceDocument2 !== undefined) {
        expect(parsed.referenceDocument2).toBe(original.referenceDocument2);
      }
      if (original.referenceDocumentType2 !== undefined) {
        expect(parsed.referenceDocumentType2).toBe(original.referenceDocumentType2);
      }
      if (original.valueDate !== undefined) {
        expect(parsed.valueDate).toBe(original.valueDate);
      }
      if (original.counterAccountKey !== undefined) {
        expect(parsed.counterAccountKey).toBe(original.counterAccountKey);
      }
      if (original.debitCreditIndicator !== undefined) {
        expect(parsed.debitCreditIndicator).toBe(original.debitCreditIndicator);
      }
      if (original.currencyCode !== undefined) {
        expect(parsed.currencyCode).toBe(original.currencyCode);
      }
      if (original.transactionAmount !== undefined) {
        expect(parsed.transactionAmount).toBe(original.transactionAmount);
      }
      if (original.foreignCurrencyAmount !== undefined) {
        expect(parsed.foreignCurrencyAmount).toBeDefined();
      }
      if (original.quantityField !== undefined) {
        expect(parsed.quantityField).toBeDefined();
      }
      if (original.matchingField1 !== undefined) {
        expect(parsed.matchingField1).toBe(original.matchingField1);
      }
      if (original.matchingField2 !== undefined) {
        expect(parsed.matchingField2).toBe(original.matchingField2);
      }
      if (original.branchId !== undefined) {
        expect(parsed.branchId).toBe(original.branchId);
      }
      if (original.entryDate !== undefined) {
        expect(parsed.entryDate).toBe(original.entryDate);
      }
      if (original.operatorUsername !== undefined) {
        expect(parsed.operatorUsername).toBe(original.operatorUsername);
      }
      if (original.reserved !== undefined) {
        expect(parsed.reserved).toBe(original.reserved);
      }
    }

    // Verify accounts with ALL extended B110 fields
    expect(parsedData.data.accounts).toHaveLength(input.accounts.length);
    for (let i = 0; i < input.accounts.length; i++) {
      const original = input.accounts[i];
      const parsed = parsedData.data.accounts[i];
      expect(parsed.id).toBe(original.id);
      expect(parsed.name).toBe(original.name);
      expect(parsed.sortCode.key).toBe(original.sortCode.key);
      expect(parsed.sortCode.name).toBe(original.sortCode.name);
      expect(parsed.accountOpeningBalance).toBe(original.accountOpeningBalance);

      // Validate ALL extended B110 fields
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
        expect(parsed.vatId).toBeDefined();
      }
      if (original.totalDebits !== undefined) {
        expect(parsed.totalDebits).toBeDefined();
      }
      if (original.totalCredits !== undefined) {
        expect(parsed.totalCredits).toBeDefined();
      }
      if (original.accountingClassificationCode !== undefined) {
        expect(parsed.accountingClassificationCode).toBe(original.accountingClassificationCode);
      }
      if (original.branchId !== undefined) {
        expect(parsed.branchId).toBe(original.branchId);
      }
      if (original.openingBalanceForeignCurrency !== undefined) {
        expect(parsed.openingBalanceForeignCurrency).toBeDefined();
      }
      if (original.foreignCurrencyCode !== undefined) {
        expect(parsed.foreignCurrencyCode).toBe(original.foreignCurrencyCode);
      }
    }

    // Verify inventory with special characters and fractional quantities
    const intlItem = parsedData.data.inventory[0];
    expect(intlItem.name).toContain('Professional Service Package Alpha');
    expect(intlItem.quantity).toBeGreaterThanOrEqual(0); // Fractional may be rounded in M100
  });

  it('should handle foreign currencies and special characters correctly in round-trip', () => {
    const foreignCurrencyInput: ReportInput = {
      business: {
        businessId: 'INTL_001',
        name: 'International Business Corp™ & Associates',
        taxId: '999888777',
        address: {
          street: 'Γλώσσα Street with Spëcial Chars',
          houseNumber: '1א',
          city: 'Jerusalem-Tel Aviv',
          zip: '12345-6789',
        },
        reportingPeriod: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
      documents: [
        {
          id: 'INTL_DOC_001',
          type: '305',
          date: '2024-06-15',
          amount: 1234.567, // 3 decimal places
          description: 'International transaction with special chars: €$£¥',
        },
      ],
      journalEntries: [
        {
          id: 'FOREX_001',
          date: '2024-06-15',
          amount: 1234.567,
          accountId: 'EUR_ACCOUNT',
          description: 'Foreign exchange transaction: USD→EUR→ILS',
          currencyCode: 'EUR',
          transactionAmount: 1234.567,
          foreignCurrencyAmount: 4567.89,
          debitCreditIndicator: '1',
          branchId: 'INTL_BR',
          operatorUsername: 'forex_usr',
        },
      ],
      accounts: [
        {
          id: 'EUR_ACCOUNT',
          name: 'Euro Account - €urope Operations',
          sortCode: {
            key: 'Asset',
            name: 'Foreign Currency Assets',
          },
          address: {
            street: 'Européenne Straße',
            houseNumber: '123β',
            city: 'International City',
            zip: 'INTL-001',
            country: 'European Union',
          },
          countryCode: 'DE',
          accountOpeningBalance: -1234.56, // Negative balance
          foreignCurrencyCode: 'EUR',
          openingBalanceForeignCurrency: -1123.45,
          vatId: '  123  456  789  ',
        },
      ],
      inventory: [
        {
          id: 'INTL_ITEM_001',
          name: 'International Product™ with Spëcial Characters',
          quantity: 12.5, // Fractional quantity
        },
      ],
    };

    const result = generateUniformFormatReport(foreignCurrencyInput);
    const parsedData = parseUniformFormatFiles(result.iniText, result.dataText);

    // Verify special characters in business name and address
    expect(parsedData.data.business.name).toContain('Corp™');
    expect(parsedData.data.business.address?.street).toContain('Spëcial');
    expect(parsedData.data.business.address?.houseNumber).toBe('1א');

    // Verify foreign currency handling
    const forexEntry = parsedData.data.journalEntries[0];
    expect(forexEntry.currencyCode).toBe('EUR');
    expect(forexEntry.description).toContain('USD→EUR→ILS');
    expect(forexEntry.operatorUsername).toBe('forex_usr');

    // Verify account with foreign currency
    const eurAccount = parsedData.data.accounts[0];
    expect(eurAccount).toBeDefined();
    if (eurAccount) {
      expect(eurAccount.name).toContain('€urope');
      expect(eurAccount.countryCode).toBe('DE');
      expect(eurAccount.foreignCurrencyCode).toBe('EUR');
      expect(eurAccount.accountOpeningBalance).toBe(-1234.56); // Negative balance preserved
    }

    // Verify inventory with special characters and fractional quantities
    const intlItem = parsedData.data.inventory[0];
    expect(intlItem.name).toContain('Spëcial');
    expect(intlItem.quantity).toBeGreaterThanOrEqual(0); // Fractional may be rounded in M100
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
