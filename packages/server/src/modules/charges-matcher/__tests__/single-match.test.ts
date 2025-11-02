import { describe, expect, it } from 'vitest';
import type { Document, DocumentCharge, Transaction, TransactionCharge } from '../types.js';
import {
  findMatches,
} from '../providers/single-match.provider.js';
import { createMockTransaction, createMockDocument } from './test-helpers.js';

// Test user and business IDs
const USER_ID = 'user-123';
const BUSINESS_A = 'business-a';
const BUSINESS_B = 'business-b';

// Helper to create transaction charge
function createTxCharge(
  chargeId: string,
  transactions: Transaction[],
): TransactionCharge {
  return {
    chargeId,
    transactions,
  };
}

// Helper to create document charge
function createDocCharge(
  chargeId: string,
  documents: Document[],
): DocumentCharge {
  return {
    chargeId,
    documents,
  };
}

describe('Single-Match Provider', () => {
  describe('findMatches', () => {
    describe('Valid Transaction Charge → Finds Document Matches', () => {
      it('should find matching document charges for transaction charge', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({
            amount: "100",
            currency: 'USD',
            event_date: new Date('2024-01-15'),
          }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
            }),
          ]),
          createDocCharge('doc-charge-2', [
            createMockDocument({
              total_amount: 110,
              currency_code: 'USD',
              date: new Date('2024-01-16'),
            }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(2);
        expect(results[0].chargeId).toBe('doc-charge-1'); // Perfect match
        expect(results[0].confidenceScore).toBeGreaterThan(0.95);
        expect(results[1].chargeId).toBe('doc-charge-2'); // Partial match
        expect(results[1].confidenceScore).toBeLessThan(0.95);
      });

      it('should exclude transaction candidates when source is transaction', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [createMockTransaction()]);

        const candidateCharges = [
          createTxCharge('tx-charge-2', [createMockTransaction()]), // Should be excluded
          createDocCharge('doc-charge-1', [createMockDocument()]), // Should be included
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].chargeId).toBe('doc-charge-1');
      });
    });

    describe('Valid Document Charge → Finds Transaction Matches', () => {
      it('should find matching transaction charges for document charge', () => {
        const sourceCharge = createDocCharge('doc-charge-1', [
          createMockDocument({
            total_amount: 100,
            currency_code: 'USD',
            date: new Date('2024-01-15'),
          }),
        ]);

        const candidateCharges = [
          createTxCharge('tx-charge-1', [
            createMockTransaction({
              amount: "100",
              currency: 'USD',
              event_date: new Date('2024-01-15'),
            }),
          ]),
          createTxCharge('tx-charge-2', [
            createMockTransaction({
              amount: "90",
              currency: 'USD',
              event_date: new Date('2024-01-16'),
            }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(2);
        expect(results[0].chargeId).toBe('tx-charge-1'); // Perfect match
        expect(results[1].chargeId).toBe('tx-charge-2'); // Partial match
      });

      it('should exclude document candidates when source is document', () => {
        const sourceCharge = createDocCharge('doc-charge-1', [createMockDocument()]);

        const candidateCharges = [
          createDocCharge('doc-charge-2', [createMockDocument()]), // Should be excluded
          createTxCharge('tx-charge-1', [createMockTransaction()]), // Should be included
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].chargeId).toBe('tx-charge-1');
      });
    });

    describe('Matched Charge Input → Throws Error', () => {
      it('should throw error if source has both transactions and documents', () => {
        const matchedCharge = {
          chargeId: 'matched-charge',
          transactions: [createMockTransaction()],
          documents: [createMockDocument()],
        } as any;

        expect(() => findMatches(matchedCharge, [], USER_ID)).toThrow(
          /already matched.*both transactions and documents/,
        );
      });

      it('should throw error if source has neither transactions nor documents', () => {
        const emptyCharge = {
          chargeId: 'empty-charge',
          transactions: [],
          documents: [],
        } as any;

        expect(() => findMatches(emptyCharge, [], USER_ID)).toThrow(
          /no transactions or documents/,
        );
      });
    });

    describe('Multiple Currencies in Source → Error Propagates', () => {
      it('should throw error for source with mixed currencies', () => {
        const mixedCurrencyCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ currency: 'USD' }),
          createMockTransaction({ currency: 'EUR' }),
        ]);

        expect(() => findMatches(mixedCurrencyCharge, [], USER_ID)).toThrow(
          /failed validation.*multiple currencies/,
        );
      });

      it('should throw error for source with multiple business IDs', () => {
        const mixedBusinessCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ business_id: BUSINESS_A }),
          createMockTransaction({ business_id: BUSINESS_B }),
        ]);

        expect(() => findMatches(mixedBusinessCharge, [], USER_ID)).toThrow(
          /failed validation.*multiple business/,
        );
      });

      it('should throw error for source document with invalid business extraction', () => {
        const invalidDocCharge = createDocCharge('doc-charge-1', [
          createMockDocument({
            creditor_id: 'other-user',
            debtor_id: 'another-user',
          }),
        ]);

        expect(() => findMatches(invalidDocCharge, [], USER_ID)).toThrow(/failed validation/);
      });
    });

    describe('No Candidates Found → Empty Array', () => {
      it('should return empty array when no candidates provided', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [createMockTransaction()]);

        const results = findMatches(sourceCharge, [], USER_ID);

        expect(results).toEqual([]);
      });

      it('should return empty array when all candidates are same type', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [createMockTransaction()]);

        const candidateCharges = [
          createTxCharge('tx-charge-2', [createMockTransaction()]),
          createTxCharge('tx-charge-3', [createMockTransaction()]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toEqual([]);
      });

      it('should return empty array when all candidates outside date window', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ event_date: new Date('2024-01-15') }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [
            createMockDocument({ date: new Date('2023-01-01') }), // 1 year before
          ]),
          createDocCharge('doc-charge-2', [
            createMockDocument({ date: new Date('2025-02-01') }), // 1 year after
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toEqual([]);
      });

      it('should return empty array when all candidates fail scoring', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ currency: 'USD' }),
        ]);

        // Candidates with mixed currencies will fail scoring
        const candidateCharges = [
          createDocCharge('doc-charge-1', [
            createMockDocument({ currency_code: 'USD' }),
            createMockDocument({ currency_code: 'EUR' }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toEqual([]);
      });
    });

    describe('Candidate Count Handling', () => {
      it('should return all candidates when fewer than 5', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [createMockTransaction()]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [createMockDocument()]),
          createDocCharge('doc-charge-2', [createMockDocument()]),
          createDocCharge('doc-charge-3', [createMockDocument()]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(3);
      });

      it('should return top 5 when more than 5 candidates', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ amount: "100" }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [createMockDocument({ total_amount: 100 })]), // Perfect
          createDocCharge('doc-charge-2', [createMockDocument({ total_amount: 101 })]),
          createDocCharge('doc-charge-3', [createMockDocument({ total_amount: 102 })]),
          createDocCharge('doc-charge-4', [createMockDocument({ total_amount: 103 })]),
          createDocCharge('doc-charge-5', [createMockDocument({ total_amount: 104 })]),
          createDocCharge('doc-charge-6', [createMockDocument({ total_amount: 105 })]),
          createDocCharge('doc-charge-7', [createMockDocument({ total_amount: 106 })]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(5);
        expect(results[0].chargeId).toBe('doc-charge-1'); // Best match
      });

      it('should respect custom maxMatches option', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [createMockTransaction()]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [createMockDocument()]),
          createDocCharge('doc-charge-2', [createMockDocument()]),
          createDocCharge('doc-charge-3', [createMockDocument()]),
          createDocCharge('doc-charge-4', [createMockDocument()]),
          createDocCharge('doc-charge-5', [createMockDocument()]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID, { maxMatches: 3 });

        expect(results).toHaveLength(3);
      });
    });

    describe('Tie-Breaking by Date Proximity', () => {
      it('should use date proximity as tie-breaker when confidence scores equal', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({
            amount: "100",
            event_date: new Date('2024-01-15'),
          }),
        ]);

        // All have same amounts (same confidence), different dates
        const candidateCharges = [
          createDocCharge('doc-charge-far', [
            createMockDocument({
              total_amount: 100,
              date: new Date('2024-01-05'), // 10 days away
            }),
          ]),
          createDocCharge('doc-charge-close', [
            createMockDocument({
              total_amount: 100,
              date: new Date('2024-01-14'), // 1 day away
            }),
          ]),
          createDocCharge('doc-charge-medium', [
            createMockDocument({
              total_amount: 100,
              date: new Date('2024-01-10'), // 5 days away
            }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results[0].chargeId).toBe('doc-charge-close'); // Closest date wins
        expect(results[1].chargeId).toBe('doc-charge-medium');
        expect(results[2].chargeId).toBe('doc-charge-far');
      });

      it('should include dateProximity in results', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ event_date: new Date('2024-01-15') }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [
            createMockDocument({ date: new Date('2024-01-14') }), // 1 day
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results[0].dateProximity).toBe(1);
      });
    });

    describe('Date Window Filtering', () => {
      it('should filter candidates outside 12-month window by default', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ event_date: new Date('2024-01-15') }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-inside', [
            createMockDocument({ date: new Date('2024-06-15') }), // 5 months
          ]),
          createDocCharge('doc-outside', [
            createMockDocument({ date: new Date('2025-02-15') }), // 13 months
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].chargeId).toBe('doc-inside');
      });

      it('should respect custom dateWindowMonths option', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ event_date: new Date('2024-01-15') }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-inside', [
            createMockDocument({ date: new Date('2024-03-15') }), // 2 months
          ]),
          createDocCharge('doc-outside', [
            createMockDocument({ date: new Date('2024-05-15') }), // 4 months
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID, {
          dateWindowMonths: 3,
        });

        expect(results).toHaveLength(1);
        expect(results[0].chargeId).toBe('doc-inside');
      });

      it('should include candidates on exact window boundary', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ event_date: new Date('2024-01-15') }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-boundary', [
            createMockDocument({ date: new Date('2025-01-15') }), // Exactly 12 months
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
      });
    });

    describe('Fee Transactions Excluded', () => {
      it('should handle source with fee transactions via aggregator', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ amount: "100", is_fee: false }),
          createMockTransaction({ amount: "5", is_fee: true }), // Should be excluded by aggregator
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [createMockDocument({ total_amount: 100 })]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].confidenceScore).toBeGreaterThan(0.95); // Matches 100, not 105
      });

      it('should throw error if all source transactions are fees', () => {
        const allFeesCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ is_fee: true }),
          createMockTransaction({ is_fee: true }),
        ]);

        expect(() => findMatches(allFeesCharge, [], USER_ID)).toThrow(
          /all transactions are marked as fees/,
        );
      });
    });

    describe('Same ChargeId → Throws Error', () => {
      it('should throw error when candidate has same chargeId as source', () => {
        const sourceCharge = createTxCharge('same-charge-id', [createMockTransaction()]);

        const candidateCharges = [
          createDocCharge('same-charge-id', [createMockDocument()]), // Same ID!
        ];

        expect(() => findMatches(sourceCharge, candidateCharges, USER_ID)).toThrow(
          /same ID as source charge/,
        );
      });
    });

    describe('Various Confidence Levels', () => {
      it('should rank matches by confidence level correctly', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({
            amount: "100",
            currency: 'USD',
            event_date: new Date('2024-01-15'),
            business_id: BUSINESS_A,
          }),
        ]);

        const candidateCharges = [
          // Perfect match - all fields align
          createDocCharge('perfect', [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
              creditor_id: BUSINESS_A,
              debtor_id: USER_ID,
            }),
          ]),
          // Good match - date difference
          createDocCharge('good', [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-20'), // 5 days off
              creditor_id: BUSINESS_A,
              debtor_id: USER_ID,
            }),
          ]),
          // Medium match - slight amount difference
          createDocCharge('medium', [
            createMockDocument({
              total_amount: 100.5,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
              creditor_id: BUSINESS_A,
              debtor_id: USER_ID,
            }),
          ]),
          // Poor match - business mismatch
          createDocCharge('poor', [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
              creditor_id: BUSINESS_B, // Different business
              debtor_id: USER_ID,
            }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(4);
        expect(results[0].chargeId).toBe('perfect');
        expect(results[0].confidenceScore).toBeGreaterThan(0.95);
        expect(results[1].chargeId).toBe('good');
        expect(results[2].chargeId).toBe('medium');
        expect(results[3].chargeId).toBe('poor');
      });

      it('should include component scores in results', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [createMockTransaction()]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [createMockDocument()]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results[0].components).toBeDefined();
        expect(results[0].components.amount).toBeGreaterThanOrEqual(0);
        expect(results[0].components.currency).toBeGreaterThanOrEqual(0);
        expect(results[0].components.business).toBeGreaterThanOrEqual(0);
        expect(results[0].components.date).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle multiple transactions in source charge', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ amount: "50" }),
          createMockTransaction({ amount: "50" }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [createMockDocument({ total_amount: 100 })]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].confidenceScore).toBeGreaterThan(0.95); // 50+50 = 100
      });

      it('should handle multiple documents in candidate charge', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ amount: "100" }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [
            createMockDocument({ total_amount: 60 }),
            createMockDocument({ total_amount: 40 }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].confidenceScore).toBeGreaterThan(0.95); // 60+40 = 100
      });

      it('should handle negative amounts (credit transactions)', () => {
        const sourceCharge = createTxCharge('tx-charge-1', [
          createMockTransaction({ amount: "-100" }),
        ]);

        const candidateCharges = [
          createDocCharge('doc-charge-1', [
            createMockDocument({
              total_amount: 100,
              type: 'CREDIT_INVOICE',
              creditor_id: USER_ID, // User is creditor for credit invoice
              debtor_id: BUSINESS_A,
            }),
          ]),
        ];

        const results = findMatches(sourceCharge, candidateCharges, USER_ID);

        expect(results).toHaveLength(1);
        expect(results[0].confidenceScore).toBeGreaterThan(0.9);
      });
    });
  });
});
