import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';

describe('vatId Validation', () => {
  const validTestInput = {
    business: {
      businessId: '12345',
      name: 'Test Company',
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
    journalEntries: [],
    inventory: [],
  };

  it('should accept valid tax IDs with only digits', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          vatId: '123456789', // Only digits - should pass
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).not.toThrow();
  });

  it('should accept valid tax IDs with digits and spaces', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          vatId: '  123 456 789  ', // Digits with spaces - should pass
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).not.toThrow();
  });

  it('should accept empty tax ID', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          vatId: '', // Empty - should pass
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).not.toThrow();
  });

  it('should accept undefined tax ID', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          // vatId not provided - should pass
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).not.toThrow();
  });

  it('should throw error for tax ID with letters', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          vatId: 'IL123456789', // Contains letters - should fail
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).toThrow(
      'Invalid vatId for account 1100: "IL123456789" contains non-digit characters',
    );
  });

  it('should throw error for tax ID with special characters', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          vatId: '123-456-789', // Contains dashes - should fail
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).toThrow(
      'Invalid vatId for account 1100: "123-456-789" contains non-digit characters',
    );
  });

  it('should throw error for tax ID with mixed characters', () => {
    const input = {
      ...validTestInput,
      accounts: [
        {
          id: '1100',
          name: 'Test Account',
          sortCode: { key: 'Asset', name: 'Assets' },
          accountOpeningBalance: 1000,
          countryCode: 'IL',
          vatId: 'ABC 123 456', // Contains letters and digits - should fail
        },
      ],
    };

    expect(() => generateUniformFormatReport(input)).toThrow(
      'Invalid vatId for account 1100: "ABC 123 456" contains non-digit characters',
    );
  });
});
