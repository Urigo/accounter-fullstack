import { describe, expect, it, vi } from 'vitest';
import type { AggregatedTransaction, DocumentCharge, TransactionCharge } from '../types.js';
import {
  scoreMatch,
  selectTransactionDate,
} from '../providers/match-scorer.provider.js';
import { createMockTransaction, createMockDocument } from './test-helpers.js';
import { Injector } from 'graphql-modules';

// Mock DI system and ClientsProvider
vi.mock('../../financial-entities/providers/clients.provider.js', () => ({
  ClientsProvider: class {},
}));

// Test user ID
const USER_ID = 'user-123';
const BUSINESS_ID = 'business-abc';

// Create a mock injector for testing client matching


// Create a mock injector for testing
const createMockInjector = () => ({
  get: vi.fn((token: any) => {
    if (token.name === 'ClientsProvider')
      return {
        getClientByIdLoader: {
          load: (businessId: string) => {
            const isRegisteredClient = businessId.startsWith('client-');
            return Promise.resolve(isRegisteredClient ? { id: businessId } : null);
          },
        },
      };
  }),
}) as Injector;

// Spy-able injector to assert DataLoader usage
const createSpyInjector = (loaderImpl?: (businessId: string) => Promise<any>) => {
  const load = vi.fn(loaderImpl ?? (() => Promise.resolve(null)));
  const get = vi.fn((token: any) => {
    if (token.name === 'ClientsProvider') {
      return {
        getClientByIdLoader: { load },
      };
    }
  });
  return { get, load } as unknown as Injector & { load: typeof load };
};

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
      it('should score perfect match close to 1.0', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.chargeId).toBe('charge-doc-1');
        expect(result.confidenceScore).toBeGreaterThan(0.95);
        expect(result.components.amount).toBe(1.0);
        expect(result.components.currency).toBe(1.0);
        expect(result.components.business).toBe(1.0);
        // Non-client same-business: uses standard date calculation, not flat 1.0
        expect(result.components.date).toBe(1.0);
      });

      it('should handle receipt matching with event_date', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-2',
          transactions: [
            createMockTransaction({
              amount: "200.00",
              event_date: new Date('2024-01-10'),
              debit_date: new Date('2024-01-15'),
              debit_timestamp: null,
              business_id: 'customer-receipt', // Different business for cross-business test
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
              creditor_id: 'vendor-receipt', // Different business
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.confidenceScore).toBeGreaterThan(0.70); // Amount + currency + date good, business mismatch
        expect(result.components.date).toBeCloseTo(0.83, 1);
      });
    });

    describe('Partial Matches', () => {
      it('should handle amount mismatch', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-3',
          transactions: [createMockTransaction({ amount: "100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-3',
          documents: [createMockDocument({ total_amount: 110 })], // 10% difference
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBeLessThan(1.0);
        expect(result.components.amount).toBeGreaterThan(0.0);
        expect(result.confidenceScore).toBeLessThan(0.95);
      });

      it('should handle currency mismatch', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-4',
          transactions: [createMockTransaction({ currency: 'USD' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-4',
          documents: [createMockDocument({ currency_code: 'EUR' })],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.currency).toBe(0.0); // Different currencies = 0.0
        // Overall confidence can still be decent if other factors match
        expect(result.confidenceScore).toBeLessThan(1.0);
      });

      it('should handle business mismatch', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.business).toBe(0.2);
      });

      it('should handle date difference', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-6',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'customer-1', // Different business for cross-business test
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-6',
          documents: [
            createMockDocument({
              date: new Date('2024-01-16'), // 15 days difference
              creditor_id: 'vendor-1', // Different business
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBe(0.5); // 15/30 = 0.5
      });
    });

    describe('Client-aware date confidence', () => {
      it('returns flat 1.0 for client same-business on same day', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-same-day',
          transactions: [
            createMockTransaction({
              amount: "100.00",
              currency: 'USD',
              event_date: new Date('2024-01-15'),
              business_id: 'client-abc',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-client-same-day',
          documents: [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
              creditor_id: 'client-abc',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector(async () => ({ id: 'client-abc' }));
        const result = await scoreMatch(txCharge, docCharge, USER_ID, spyInjector as any);

        expect(result.components.date).toBe(1.0);
        expect(spyInjector.load).toHaveBeenCalledTimes(1);
      });

      it('returns flat 1.0 for client same-business 30 days apart', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-30',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'client-xyz',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-client-30',
          documents: [
            createMockDocument({
              date: new Date('2024-01-31'),
              creditor_id: 'client-xyz',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector(async () => ({ id: 'client-xyz' }));
        const result = await scoreMatch(txCharge, docCharge, USER_ID, spyInjector as any);

        expect(result.components.date).toBe(1.0);
        expect(spyInjector.load).toHaveBeenCalledTimes(1);
      });

      it('returns flat 1.0 for client same-business 365 days apart', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-365',
          transactions: [
            createMockTransaction({
              event_date: new Date('2023-01-01'),
              business_id: 'client-long',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-client-365',
          documents: [
            createMockDocument({
              date: new Date('2024-01-01'),
              creditor_id: 'client-long',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector(async () => ({ id: 'client-long' }));
        const result = await scoreMatch(txCharge, docCharge, USER_ID, spyInjector as any);

        expect(result.components.date).toBe(1.0);
        expect(spyInjector.load).toHaveBeenCalledTimes(1);
      });

      it('uses standard degradation for non-client same-business (15 days)', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-nonclient-15',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'vendor-plain',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-nonclient-15',
          documents: [
            createMockDocument({
              date: new Date('2024-01-16'),
              creditor_id: 'vendor-plain',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBe(0.5);
      });

      it('uses standard degradation for non-client same-business (45 days)', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-nonclient-45',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'vendor-far',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-nonclient-45',
          documents: [
            createMockDocument({
              date: new Date('2024-02-15'),
              creditor_id: 'vendor-far',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBe(0.0);
      });

      it('uses standard degradation for cross-business matches', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-cross',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'customer-xyz',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-cross',
          documents: [
            createMockDocument({
              date: new Date('2024-01-06'),
              creditor_id: 'vendor-xyz',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBeCloseTo(0.83, 1);
      });

      it('skips client lookup when businessId is null', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-null-business',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: null,
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-null-business',
          documents: [
            createMockDocument({
              date: new Date('2024-01-16'),
              creditor_id: USER_ID,
              debtor_id: null,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector();
        const result = await scoreMatch(txCharge, docCharge, USER_ID, spyInjector as any);

        expect(result.components.date).toBe(0.5);
        expect(spyInjector.load).not.toHaveBeenCalled();
      });

      it('uses ClientsProvider result when lookup succeeds', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-lookup',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'client-lookup',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-client-lookup',
          documents: [
            createMockDocument({
              date: new Date('2024-02-01'),
              creditor_id: 'client-lookup',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector(async () => ({ id: 'client-lookup' }));
        const result = await scoreMatch(txCharge, docCharge, USER_ID, spyInjector as any);

        expect(result.components.date).toBe(1.0);
        expect(spyInjector.load).toHaveBeenCalledTimes(1);
      });

      it('uses standard degradation when ClientsProvider returns null', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-null',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'),
              business_id: 'client-missing',
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-client-null',
          documents: [
            createMockDocument({
              date: new Date('2024-01-11'),
              creditor_id: 'client-missing',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector(async () => null);
        const result = await scoreMatch(txCharge, docCharge, USER_ID, spyInjector as any);

        expect(result.components.date).toBeCloseTo(0.67, 1);
        expect(spyInjector.load).toHaveBeenCalledTimes(1);
      });

      it('gives equal date scores for multiple client invoices regardless of recency', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-multi',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-15'),
              business_id: 'client-multi',
            }),
          ],
        };

        const janDoc: DocumentCharge = {
          chargeId: 'charge-doc-client-jan',
          documents: [
            createMockDocument({
              date: new Date('2024-01-30'),
              creditor_id: 'client-multi',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const febDoc: DocumentCharge = {
          chargeId: 'charge-doc-client-feb',
          documents: [
            createMockDocument({
              date: new Date('2024-02-28'),
              creditor_id: 'client-multi',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const spyInjector = createSpyInjector(async () => ({ id: 'client-multi' }));
        const janScore = await scoreMatch(txCharge, janDoc, USER_ID, spyInjector as any);
        const febScore = await scoreMatch(txCharge, febDoc, USER_ID, spyInjector as any);

        expect(janScore.components.date).toBe(1.0);
        expect(febScore.components.date).toBe(1.0);
        expect(spyInjector.load).toHaveBeenCalledTimes(2);
      });

      it('prefers closer date for non-client when amounts tie', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-nonclient-multi',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-15'),
              business_id: 'vendor-multi',
            }),
          ],
        };

        const nearDoc: DocumentCharge = {
          chargeId: 'charge-doc-nonclient-near',
          documents: [
            createMockDocument({
              date: new Date('2024-01-17'),
              creditor_id: 'vendor-multi',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const farDoc: DocumentCharge = {
          chargeId: 'charge-doc-nonclient-far',
          documents: [
            createMockDocument({
              date: new Date('2024-02-20'),
              creditor_id: 'vendor-multi',
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const nearScore = await scoreMatch(txCharge, nearDoc, USER_ID, createMockInjector());
        const farScore = await scoreMatch(txCharge, farDoc, USER_ID, createMockInjector());

        expect(nearScore.components.date).toBeGreaterThan(farScore.components.date);
      });
    });

    describe('Date Type Selection', () => {
      it('should use event_date for INVOICE matching', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBe(1.0); // Should match event_date
      });

      it('should use event_date for RECEIPT matching', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-8',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-10'),
              debit_date: new Date('2024-01-15'),
              debit_timestamp: null,
              business_id: 'customer-2', // Different business for cross-business test
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-8',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'), // Matches debit_date
              type: 'RECEIPT',
              creditor_id: 'vendor-2', // Different business
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBeCloseTo(0.83, 1);
      });

      it('should fall back to event_date for RECEIPT when debit_date is null', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBe(1.0);
      });
    });

    describe('Flexible Document Types (PROFORMA/OTHER/UNPROCESSED)', () => {
      it('should use event_date for PROFORMA and use better score', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-10',
          transactions: [
            createMockTransaction({
              event_date: new Date('2024-01-01'), // Far from document date
              debit_date: new Date('2024-01-15'), // Matches document date
              debit_timestamp: null,
              business_id: 'customer-3', // Different business for cross-business test
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-10',
          documents: [
            createMockDocument({
              date: new Date('2024-01-15'),
              type: 'PROFORMA',
              creditor_id: 'vendor-3', // Different business
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        // Should use event_date (2024-01-01) vs latest doc date (2024-01-15) = 14 days
        // Date confidence: 1.0 - 14/30 = 0.53
        expect(result.components.date).toBeCloseTo(0.53, 1);
      });

      it('should handle OTHER type with both dates', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        // Should use event_date since it matches better
        expect(result.components.date).toBe(1.0);
      });

      it('should handle UNPROCESSED type', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.date).toBe(1.0);
      });

      it('should handle flexible type without debit_date', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        // Should only use event_date
        expect(result.components.date).toBe(1.0);
      });
    });

    describe('Amount Variations', () => {
      it('should handle small amount differences', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-14',
          transactions: [createMockTransaction({ amount: "100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-14',
          documents: [createMockDocument({ total_amount: 100.5 })], // 0.5 difference
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBeGreaterThanOrEqual(0.9); // Within 1 unit = exactly 0.9
      });

      it('should handle large amount differences', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-15',
          transactions: [createMockTransaction({ amount: "100.00" })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-15',
          documents: [createMockDocument({ total_amount: 150 })], // 50% difference
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBe(0.0);
      });
    });

    describe('Integration Tests', () => {
      it('should handle multiple transactions and documents', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBe(1.0); // 50 + 50 = 100
        expect(result.confidenceScore).toBeGreaterThan(0.95);
      });

      it('should handle credit invoice (negative amounts)', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBe(1.0);
      });

      it('should handle real-world scenario with slight variations', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBeGreaterThanOrEqual(0.9); // Within 1 unit = 0.9
        expect(result.components.currency).toBe(1.0);
        expect(result.components.business).toBe(1.0);
        expect(result.components.date).toBeGreaterThan(0.95); // 1 day = 0.97
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      });

      it('should apply flat date confidence for CLIENT same-business matches', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-client-1',
          transactions: [
            createMockTransaction({
              amount: "500.00",
              currency: 'USD',
              event_date: new Date('2024-02-01'),
              business_id: 'client-acme', // Registered client
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-client-1',
          documents: [
            createMockDocument({
              total_amount: 500,
              currency_code: 'USD',
              date: new Date('2024-03-01'), // 28 days later - would normally be 0.07
              creditor_id: 'client-acme', // Same business, registered client
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector() as any);

        // For client same-business: date confidence should be 1.0 (flat)
        expect(result.components.date).toBe(1.0);
        // Overall confidence should be very high
        expect(result.confidenceScore).toBeGreaterThan(0.95);
      });

      it('should use standard date degradation for NON-CLIENT same-business matches', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-nonc-1',
          transactions: [
            createMockTransaction({
              amount: "500.00",
              currency: 'USD',
              event_date: new Date('2024-02-01'),
              business_id: 'vendor-bob', // NOT a client (no 'client-' prefix)
            }),
          ],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-nonc-1',
          documents: [
            createMockDocument({
              total_amount: 500,
              currency_code: 'USD',
              date: new Date('2024-03-01'), // 28 days later = 1.0 - 28/30 = 0.07
              creditor_id: 'vendor-bob', // Same business, but NOT a client
              debtor_id: USER_ID,
              type: 'INVOICE',
            }),
          ],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        // For non-client same-business: date confidence should use standard degradation
        expect(result.components.date).toBeCloseTo(0.07, 1);
        // Overall confidence lower due to date mismatch
        // Calculation: (amount: 1.0 * 0.4) + (currency: 1.0 * 0.2) + (business: 1.0 * 0.3) + (date: 0.07 * 0.1)
        //           = 0.4 + 0.2 + 0.3 + 0.007 = 0.907 ≈ 0.91
        expect(result.confidenceScore).toBeLessThanOrEqual(0.91);
      });
    });

    describe('Error Propagation', () => {
      it('should throw error for mixed currencies in transactions', async () => {
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

        await expect(scoreMatch(txCharge, docCharge, USER_ID, createMockInjector())).rejects.toThrow(/multiple currencies/);
      });

      it('should throw error for mixed currencies in documents', async () => {
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

        await expect(scoreMatch(txCharge, docCharge, USER_ID, createMockInjector())).rejects.toThrow(/multiple currencies/);
      });

      it('should throw error for multiple business IDs in transactions', async () => {
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

        await expect(scoreMatch(txCharge, docCharge, USER_ID, createMockInjector())).rejects.toThrow(/multiple business/);
      });

      it('should throw error for invalid document business extraction', async () => {
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

        await expect(scoreMatch(txCharge, docCharge, USER_ID, createMockInjector())).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle null business IDs', async () => {
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

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.business).toBe(0.5);
      });

      it('should handle zero amounts', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-24',
          transactions: [createMockTransaction({ amount: '0.00' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-24',
          documents: [createMockDocument({ total_amount: 0 })],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBe(1.0);
      });

      it('should handle very large amounts', async () => {
        const txCharge: TransactionCharge = {
          chargeId: 'charge-tx-25',
          transactions: [createMockTransaction({ amount: '1000000.00' })],
        };

        const docCharge: DocumentCharge = {
          chargeId: 'charge-doc-25',
          documents: [createMockDocument({ total_amount: 1000000 })],
        };

        const result = await scoreMatch(txCharge, docCharge, USER_ID, createMockInjector());

        expect(result.components.amount).toBe(1.0);
      });
    });
  });
});
