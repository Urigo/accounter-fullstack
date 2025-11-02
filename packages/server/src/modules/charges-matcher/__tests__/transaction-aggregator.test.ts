import { describe, expect, it } from 'vitest';
import {
  aggregateTransactions,
  type Transaction,
} from '../providers/transaction-aggregator.js';

describe('Transaction Aggregator', () => {
  // Helper to create test transactions
  const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'txn-' + Math.random().toString(36).substr(2, 9),
    charge_id: 'charge-123',
    amount: "100",
    currency: 'USD',
    business_id: null,
    event_date: new Date('2024-01-15'),
    debit_date: null,
    source_description: 'Test transaction',
    is_fee: false,
    debit_timestamp: null,
    ...overrides,
  });

  describe('Single Transaction', () => {
    it('should return single transaction as-is', () => {
      const transaction = createTransaction({
        amount: "150.5",
        currency: 'USD',
        business_id: 'business-1',
        event_date: new Date('2024-01-15'),
        source_description: 'Payment from client',
      });

      const result = aggregateTransactions([transaction]);

      expect(result).toEqual({
        amount: 150.5,
        currency: 'USD',
        businessId: 'business-1',
        date: new Date('2024-01-15'),
        debitDate: null,
        description: 'Payment from client',
      });
    });

    it('should handle transaction with null business_id', () => {
      const transaction = createTransaction({
        amount: "200",
        business_id: null,
      });

      const result = aggregateTransactions([transaction]);

      expect(result.businessId).toBeNull();
    });

    it('should handle transaction with null description', () => {
      const transaction = createTransaction({
        source_description: null,
      });

      const result = aggregateTransactions([transaction]);

      expect(result.description).toBe('');
    });

    it('should handle transaction with empty description', () => {
      const transaction = createTransaction({
        source_description: '   ',
      });

      const result = aggregateTransactions([transaction]);

      expect(result.description).toBe('');
    });
  });

  describe('Multiple Transactions - Same Currency', () => {
    it('should sum amounts correctly', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'USD' }),
        createTransaction({ amount: "200", currency: 'USD' }),
        createTransaction({ amount: "50.5", currency: 'USD' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(350.5);
      expect(result.currency).toBe('USD');
    });

    it('should handle negative amounts (debits)', () => {
      const transactions = [
        createTransaction({ amount: "-100", currency: 'ILS' }),
        createTransaction({ amount: "-50", currency: 'ILS' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(-150);
      expect(result.currency).toBe('ILS');
    });

    it('should handle mixed positive and negative amounts', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'EUR' }),
        createTransaction({ amount: "-30", currency: 'EUR' }),
        createTransaction({ amount: "50", currency: 'EUR' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(120);
    });
  });

  describe('Fee Transactions', () => {
    it('should exclude transactions where is_fee is true', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'USD', is_fee: false }),
        createTransaction({ amount: "5", currency: 'USD', is_fee: true }), // Fee - should be excluded
        createTransaction({ amount: "200", currency: 'USD', is_fee: false }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(300); // 100 + 200, fee excluded
    });

    it('should exclude transactions where is_fee is null but treated as false', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'USD', is_fee: null }),
        createTransaction({ amount: "50", currency: 'USD', is_fee: false }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(150); // Both included (null treated as false)
    });

    it('should throw error when all transactions are fees', () => {
      const transactions = [
        createTransaction({ amount: "5", is_fee: true }),
        createTransaction({ amount: "3", is_fee: true }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(
        'Cannot aggregate transactions: all transactions are marked as fees',
      );
    });

    it('should not include fee descriptions in concatenation', () => {
      const transactions = [
        createTransaction({
          amount: "100",
          source_description: 'Main transaction',
          is_fee: false,
        }),
        createTransaction({ amount: "5", source_description: 'Bank fee', is_fee: true }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('Main transaction');
    });
  });

  describe('Currency Validation', () => {
    it('should throw error with multiple currencies', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'USD' }),
        createTransaction({ amount: "200", currency: 'EUR' }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(
        'Cannot aggregate transactions: multiple currencies found (USD, EUR)',
      );
    });

    it('should throw error with three different currencies', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'USD' }),
        createTransaction({ amount: "200", currency: 'EUR' }),
        createTransaction({ amount: "300", currency: 'GBP' }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(/multiple currencies found/);
    });

    it('should not throw error when all have same currency', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'ILS' }),
        createTransaction({ amount: "200", currency: 'ILS' }),
        createTransaction({ amount: "300", currency: 'ILS' }),
      ];

      expect(() => aggregateTransactions(transactions)).not.toThrow();
    });

    it('should ignore currency of fee transactions in validation', () => {
      const transactions = [
        createTransaction({ amount: "100", currency: 'USD', is_fee: false }),
        createTransaction({ amount: "5", currency: 'EUR', is_fee: true }), // Different currency but is fee
        createTransaction({ amount: "200", currency: 'USD', is_fee: false }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.currency).toBe('USD');
      expect(result.amount).toBe(300);
    });
  });

  describe('Business ID Validation', () => {
    it('should throw error with multiple different business IDs', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: 'business-1' }),
        createTransaction({ amount: "200", business_id: 'business-2' }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(
        'Cannot aggregate transactions: multiple business IDs found (business-1, business-2)',
      );
    });

    it('should throw error with three different business IDs', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: 'business-1' }),
        createTransaction({ amount: "200", business_id: 'business-2' }),
        createTransaction({ amount: "300", business_id: 'business-3' }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(/multiple business IDs found/);
    });

    it('should return null when all business IDs are null', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: null }),
        createTransaction({ amount: "200", business_id: null }),
        createTransaction({ amount: "300", business_id: null }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.businessId).toBeNull();
    });

    it('should return single non-null business ID', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: 'business-1' }),
        createTransaction({ amount: "200", business_id: null }),
        createTransaction({ amount: "300", business_id: null }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.businessId).toBe('business-1');
    });

    it('should handle multiple nulls and one business ID', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: null }),
        createTransaction({ amount: "200", business_id: 'business-xyz' }),
        createTransaction({ amount: "300", business_id: null }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.businessId).toBe('business-xyz');
    });

    it('should not throw when all have same business ID', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: 'business-1' }),
        createTransaction({ amount: "200", business_id: 'business-1' }),
        createTransaction({ amount: "300", business_id: 'business-1' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.businessId).toBe('business-1');
    });

    it('should ignore business ID of fee transactions in validation', () => {
      const transactions = [
        createTransaction({ amount: "100", business_id: 'business-1', is_fee: false }),
        createTransaction({ amount: "5", business_id: 'business-2', is_fee: true }), // Different business but is fee
        createTransaction({ amount: "200", business_id: 'business-1', is_fee: false }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.businessId).toBe('business-1');
    });
  });

  describe('Date Selection', () => {
    it('should select earliest event_date', () => {
      const transactions = [
        createTransaction({ event_date: new Date('2024-03-15') }),
        createTransaction({ event_date: new Date('2024-01-10') }), // Earliest
        createTransaction({ event_date: new Date('2024-02-20') }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.date).toEqual(new Date('2024-01-10'));
    });

    it('should select earliest from same month', () => {
      const transactions = [
        createTransaction({ event_date: new Date('2024-01-20') }),
        createTransaction({ event_date: new Date('2024-01-15') }), // Earliest
        createTransaction({ event_date: new Date('2024-01-25') }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.date).toEqual(new Date('2024-01-15'));
    });

    it('should handle dates spanning years', () => {
      const transactions = [
        createTransaction({ event_date: new Date('2024-01-15') }),
        createTransaction({ event_date: new Date('2023-12-31') }), // Earliest (previous year)
        createTransaction({ event_date: new Date('2024-02-01') }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.date).toEqual(new Date('2023-12-31'));
    });

    it('should handle same date for all transactions', () => {
      const transactions = [
        createTransaction({ event_date: new Date('2024-01-15') }),
        createTransaction({ event_date: new Date('2024-01-15') }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.date).toEqual(new Date('2024-01-15'));
    });
  });

  describe('Description Concatenation', () => {
    it('should concatenate descriptions with line breaks', () => {
      const transactions = [
        createTransaction({ source_description: 'First transaction' }),
        createTransaction({ source_description: 'Second transaction' }),
        createTransaction({ source_description: 'Third transaction' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('First transaction\nSecond transaction\nThird transaction');
    });

    it('should filter out null descriptions', () => {
      const transactions = [
        createTransaction({ source_description: 'First' }),
        createTransaction({ source_description: null }),
        createTransaction({ source_description: 'Third' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('First\nThird');
    });

    it('should filter out empty string descriptions', () => {
      const transactions = [
        createTransaction({ source_description: 'First' }),
        createTransaction({ source_description: '   ' }),
        createTransaction({ source_description: 'Third' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('First\nThird');
    });

    it('should return empty string when all descriptions are null', () => {
      const transactions = [
        createTransaction({ source_description: null }),
        createTransaction({ source_description: null }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('');
    });

    it('should preserve order of descriptions', () => {
      const transactions = [
        createTransaction({ source_description: 'Alpha' }),
        createTransaction({ source_description: 'Beta' }),
        createTransaction({ source_description: 'Gamma' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('Alpha\nBeta\nGamma');
    });

    it('should handle special characters in descriptions', () => {
      const transactions = [
        createTransaction({ source_description: 'Payment: $100 USD' }),
        createTransaction({ source_description: 'Ref #12345 (invoice)' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.description).toBe('Payment: $100 USD\nRef #12345 (invoice)');
    });
  });

  describe('Input Validation', () => {
    it('should throw error for empty array', () => {
      expect(() => aggregateTransactions([])).toThrow(
        'Cannot aggregate transactions: array is empty',
      );
    });

    it('should throw error for null input', () => {
      expect(() => aggregateTransactions(null as any)).toThrow(
        'Cannot aggregate transactions: array is empty',
      );
    });

    it('should throw error for undefined input', () => {
      expect(() => aggregateTransactions(undefined as any)).toThrow(
        'Cannot aggregate transactions: array is empty',
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle real-world scenario with fees, nulls, and mixed data', () => {
      const transactions = [
        createTransaction({
          amount: "1000",
          currency: 'USD',
          business_id: 'client-abc',
          event_date: new Date('2024-01-15'),
          source_description: 'Invoice #123 payment',
          is_fee: false,
        }),
        createTransaction({
          amount: "2.5",
          currency: 'USD',
          business_id: 'bank-xyz',
          event_date: new Date('2024-01-15'),
          source_description: 'Wire transfer fee',
          is_fee: true, // Should be excluded
        }),
        createTransaction({
          amount: "500",
          currency: 'USD',
          business_id: 'client-abc',
          event_date: new Date('2024-01-10'), // Earlier date
          source_description: 'Partial payment',
          is_fee: false,
        }),
        createTransaction({
          amount: "200",
          currency: 'USD',
          business_id: null, // Null business
          event_date: new Date('2024-01-20'),
          source_description: null, // Null description
          is_fee: false,
        }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(1700); // 1000 + 500 + 200 (fee excluded)
      expect(result.currency).toBe('USD');
      expect(result.businessId).toBe('client-abc'); // One non-null, one null
      expect(result.date).toEqual(new Date('2024-01-10')); // Earliest
      expect(result.description).toBe('Invoice #123 payment\nPartial payment'); // Fee desc excluded, null excluded
    });

    it('should handle cryptocurrency transactions', () => {
      const transactions = [
        createTransaction({ amount: "0.5", currency: 'ETH' }),
        createTransaction({ amount: "0.3", currency: 'ETH' }),
      ];

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(0.8);
      expect(result.currency).toBe('ETH');
    });

    it('should handle large number of transactions', () => {
      const transactions = Array.from({ length: 100 }, (_, i) =>
        createTransaction({
          amount: "10",
          currency: 'USD',
          event_date: new Date(`2024-01-${(i % 28) + 1}`),
        }),
      );

      const result = aggregateTransactions(transactions);

      expect(result.amount).toBe(1000); // 100 × 10
      expect(result.currency).toBe('USD');
    });
  });

  describe('Error Messages', () => {
    it('should provide descriptive error for mixed currencies', () => {
      const transactions = [
        createTransaction({ currency: 'USD' }),
        createTransaction({ currency: 'EUR' }),
        createTransaction({ currency: 'GBP' }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(
        /multiple currencies found \(USD, EUR, GBP\)/,
      );
    });

    it('should provide descriptive error for multiple business IDs', () => {
      const transactions = [
        createTransaction({ business_id: 'business-a' }),
        createTransaction({ business_id: 'business-b' }),
      ];

      expect(() => aggregateTransactions(transactions)).toThrow(
        /multiple business IDs found \(business-a, business-b\)/,
      );
    });

    it('should provide descriptive error for all fees', () => {
      const transactions = [createTransaction({ is_fee: true })];

      expect(() => aggregateTransactions(transactions)).toThrow(
        'all transactions are marked as fees',
      );
    });

    it('should provide descriptive error for empty array', () => {
      expect(() => aggregateTransactions([])).toThrow('array is empty');
    });
  });
});
