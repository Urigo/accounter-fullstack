import { describe, expect, it } from 'vitest';
import type { AggregatedTransaction, DocumentCharge, TransactionCharge } from '../types.js';
import {
  scoreMatch,
  selectTransactionDate,
} from '../providers/match-scorer.provider.js';
import { createMockTransaction, createMockDocument } from './test-helpers.js';

// Test user ID
const USER_ID = 'user-123';
const BUSINESS_ID = 'business-abc';

describe('Match Scorer', () => {
  describe('selectTransactionDate', () => {
    const transaction: AggregatedTransaction = {
      amount: 100,
      currency: 'USD' as const,
      businessId: BUSINESS_ID,
      date: new Date('2024-01-15'), // event_date
      debitDate: new Date('2024-01-20'), // debit_date
      description: 'Test',
    };

    it('should use event_date for INVOICE', () => {
      const result = selectTransactionDate(transaction, 'INVOICE');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for CREDIT_INVOICE', () => {
      const result = selectTransactionDate(transaction, 'CREDIT_INVOICE');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for RECEIPT', () => {
      const result = selectTransactionDate(transaction, 'RECEIPT');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for INVOICE_RECEIPT', () => {
      const result = selectTransactionDate(transaction, 'INVOICE_RECEIPT');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for RECEIPT when debitDate is null', () => {
      const txWithoutDebitDate = { ...transaction, debitDate: null };
      const result = selectTransactionDate(txWithoutDebitDate, 'RECEIPT');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for OTHER', () => {
      const result = selectTransactionDate(transaction, 'OTHER');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for PROFORMA', () => {
      const result = selectTransactionDate(transaction, 'PROFORMA');
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should use event_date for UNPROCESSED', () => {
      const result = selectTransactionDate(transaction, 'UNPROCESSED');
      expect(result).toEqual(new Date('2024-01-15'));
    });
  });

  describe('scoreMatch', () => {
    describe('Perfect Matches', () => {
      it('should score perfect match close to 1.0', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-1',
          transactions: [
            createMockTransaction({
              amount: '100.00',
              currency: 'USD',
              event_date: new Date('2024-01-15'),
              business_id: BUSINESS_ID,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-1',
          documents: [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
              creditor_id: BUSINESS_ID,
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.chargeId).toBe('charge-doc-1');
        expect(result.confidenceScore).toBeGreaterThan(0.95);
        expect(result.components.amount).toBe(1.0);
        expect(result.components.currency).toBe(1.0);
        expect(result.components.business).toBe(1.0);
        expect(result.components.date).toBe(1.0);
      });

      it('should handle receipt matching with event_date', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-2',
          transactions: [
            createMockTransaction({
              amount: "200.00",
              event_date: new Date('2024-01-10'),
              debit_date: new Date('2024-01-15'),
              debit_timestamp: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-2',
          documents: [
            createMockDocument({
              total_amount: 200,
              date: new Date('2024-01-15'),
              type: 'RECEIPT',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.confidenceScore).toBeGreaterThan(0.80);
        expect(result.components.date).toBeCloseTo(0.83, 1);
      });
    });

    describe('Partial Matches', () => {
      it('should handle amount mismatch', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-3',
          transactions: [createMockTransaction({ amount: "100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-3',
          documents: [createMockDocument({ total_amount: 110 })], // 10% difference
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBeLessThan(1.0);
        expect(result.components.amount).toBeGreaterThan(0.0);
        expect(result.confidenceScore).toBeLessThan(0.95);
      });

      it('should handle currency mismatch', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-4',
          transactions: [createMockTransaction({ currency: 'USD' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-4',
          documents: [createMockDocument({ currency_code: 'EUR' })],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.currency).toBe(0.0); // Different currencies = 0.0
        // Overall confidence can still be decent if other factors match
        expect(result.confidenceScore).toBeLessThan(1.0);
      });

      it('should handle business mismatch', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-5',
          transactions: [createMockTransaction({ business_id: 'business-1' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-5',
          documents: [
            createMockDocument({
              creditor_id: 'business-2',
              debtor_id: USER_ID,
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.business).toBe(0.2);
      });

      it('should handle date difference', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-6',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-6',
          documents: [
            createMockDocument({
              date: new Date('2024-01-16'), // 15 days difference
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.date).toBe(0.5); // 15/30 = 0.5
      });
    });

    describe('Date Type Selection', () => {
      it('should use event_date for INVOICE matching', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-7',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-15'),
              debit_date: new Date('2024-01-20'), // Different date
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-7',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'), // Matches event_date
              type: 'INVOICE',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.date).toBe(1.0); // Should match event_date
      });

      it('should use event_date for RECEIPT matching', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-8',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-10'),
              debit_date: new Date('2024-01-15'),
              debit_timestamp: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-8',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'), // Matches debit_date
              type: 'RECEIPT',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.date).toBeCloseTo(0.83, 1);
      });

      it('should fall back to event_date for RECEIPT when debit_date is null', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-9',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-15'),
              debit_date: null,
              debit_timestamp: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-9',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'),
              type: 'RECEIPT',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.date).toBe(1.0);
      });
    });

    describe('Flexible Document Types (PROFORMA/OTHER/UNPROCESSED)', () => {
      it('should use event_date for PROFORMA and use better score', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-10',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'), // Far from document date
              debit_date: new Date('2024-01-15'), // Matches document date
              debit_timestamp: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-10',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'),
              type: 'PROFORMA',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        // Should use event_date (2024-01-01) vs latest doc date (2024-01-15) = 14 days
        // Date confidence: 1.0 - 14/30 = 0.53
        expect(result.components.date).toBeCloseTo(0.53, 1);
      });

      it('should handle OTHER type with both dates', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-11',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-10'),
              debit_date: new Date('2024-01-25'), // Far from document
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-11',
          documents: [
            createMockDocument({
              date: new Date('2024-01-10'), // Matches event_date
              type: 'OTHER',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        // Should use event_date since it matches better
        expect(result.components.date).toBe(1.0);
      });

      it('should handle UNPROCESSED type', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-12',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-15'),
              debit_date: new Date('2024-01-15'),
              debit_timestamp: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-12',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'),
              type: 'UNPROCESSED',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.date).toBe(1.0);
      });

      it('should handle flexible type without debit_date', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-13',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-15'),
              debit_date: null,
              debit_timestamp: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-13',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'),
              type: 'OTHER',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        // Should only use event_date
        expect(result.components.date).toBe(1.0);
      });
    });

    describe('Amount Variations', () => {
      it('should handle small amount differences', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-14',
          transactions: [createMockTransaction({ amount: "100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-14',
          documents: [createMockDocument({ total_amount: 100.5 })], // 0.5 difference
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBeGreaterThanOrEqual(0.9); // Within 1 unit = exactly 0.9
      });

      it('should handle large amount differences', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-15',
          transactions: [createMockTransaction({ amount: "100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-15',
          documents: [createMockDocument({ total_amount: 150 })], // 50% difference
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBe(0.0);
      });
    });

    describe('Integration Tests', () => {
      it('should handle multiple transactions and documents', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-16',
          transactions: [
            createMockTransaction({ amount: "50.00", source_description: 'Part 1' }),
            createMockTransaction({ amount: "50.00", source_description: 'Part 2' }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-16',
          documents: [
            createMockDocument({ total_amount: 100, serial_number: 'INV-001' }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBe(1.0); // 50 + 50 = 100
        expect(result.confidenceScore).toBeGreaterThan(0.95);
      });

      it('should handle credit invoice (negative amounts)', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-17',
          transactions: [createMockTransaction({ amount: "-100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-17',
          documents: [
            createMockDocument({
              total_amount: 100,
              type: 'CREDIT_INVOICE',
              creditor_id: USER_ID, // Business is debtor
              debtor_id: BUSINESS_ID,
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBe(1.0);
      });

      it('should handle real-world scenario with slight variations', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-18',
          transactions: [
            createMockTransaction({
              amount: "1234.56",
              currency: 'USD',
              event_date: new Date('2024-03-15'),
              debit_date: new Date('2024-03-17'),
              business_id: 'vendor-xyz',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-18',
          documents: [
            createMockDocument({
              total_amount: 1234.5,
              currency_code: 'USD',
              date: new Date('2024-03-16'), // 1 day difference from tx event_date
              creditor_id: 'vendor-xyz',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBeGreaterThanOrEqual(0.9); // Within 1 unit = 0.9
        expect(result.components.currency).toBe(1.0);
        expect(result.components.business).toBe(1.0);
        expect(result.components.date).toBeGreaterThan(0.95); // 1 day = 0.97
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      });
    });

    describe('Error Propagation', () => {
      it('should throw error for mixed currencies in transactions', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-19',
          transactions: [
            createMockTransaction({ currency: 'USD' }),
            createMockTransaction({ currency: 'EUR' }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-19',
          documents: [createMockDocument()],
        };

        expect(() => scoreMatch(txCharge, docCharge, USER_ID)).toThrow(/multiple currencies/);
      });

      it('should throw error for mixed currencies in documents', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-20',
          transactions: [createMockTransaction()],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-20',
          documents: [
            createMockDocument({ currency_code: 'USD' }),
            createMockDocument({ currency_code: 'EUR' }),
          ],
        };

        expect(() => scoreMatch(txCharge, docCharge, USER_ID)).toThrow(/multiple currencies/);
      });

      it('should throw error for multiple business IDs in transactions', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-21',
          transactions: [
            createMockTransaction({ business_id: 'business-1' }),
            createMockTransaction({ business_id: 'business-2' }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-21',
          documents: [createMockDocument()],
        };

        expect(() => scoreMatch(txCharge, docCharge, USER_ID)).toThrow(/multiple business/);
      });

      it('should throw error for invalid document business extraction', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-22',
          transactions: [createMockTransaction()],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-22',
          documents: [
            createMockDocument({
              creditor_id: 'other-user',
              debtor_id: 'another-user',
            }),
          ],
        };

        expect(() => scoreMatch(txCharge, docCharge, USER_ID)).toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle null business IDs', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-23',
          transactions: [createMockTransaction({ business_id: null })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-23',
          documents: [
            createMockDocument({
              creditor_id: USER_ID,
              debtor_id: null,
            }),
          ],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.business).toBe(0.5);
      });

      it('should handle zero amounts', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-24',
          transactions: [createMockTransaction({ amount: '0.00' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-24',
          documents: [createMockDocument({ total_amount: 0 })],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBe(1.0);
      });

      it('should handle very large amounts', () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-25',
          transactions: [createMockTransaction({ amount: '1000000.00' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-25',
          documents: [createMockDocument({ total_amount: 1000000 })],
        };

        const result = scoreMatch(txCharge, docCharge, USER_ID);

        expect(result.components.amount).toBe(1.0);
      });
    });
  });
});
