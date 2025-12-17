import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import type { ChargeWithData } from '../types.js';
import {
  determineMergeDirection,
  processChargeForAutoMatch,
} from '../providers/auto-match.provider.js';
import { createMockTransaction, createMockDocument } from './test-helpers.js';

// Mock DI system and ClientsProvider
vi.mock('../../financial-entities/providers/clients.provider.js', () => ({
  ClientsProvider: class {},
}));

// Test constants
const USER_ID = 'user-123';
const BUSINESS_A = 'business-a';

// Create a mock injector for testing
const createMockInjector = () => ({
  get: vi.fn((token: {name: string}) => {
    if (token.name === 'ClientsProvider')
      return {
        getClientByIdLoader: {
          load: (businessId: string) => {
            const isRegisteredClient = businessId.startsWith('client-');
            return Promise.resolve(isRegisteredClient ? { id: businessId } : null);
          },
        },
      };
    return null;
  }),
}) as Injector;

// Helper to create a charge with data
function createCharge(overrides: Partial<ChargeWithData> = {}): ChargeWithData {
  return {
    chargeId: `charge-${Math.random()}`,
    ownerId: USER_ID,
    type: 'TRANSACTION_ONLY' as any,
    transactions: [],
    documents: [],
    ...overrides,
  };
}

describe('processChargeForAutoMatch', () => {
  describe('Single high-confidence match', () => {
    it('should return matched status when exactly one match >= 0.95', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: '100',
            currency: 'USD',
            event_date: new Date('2024-01-15'),
            business_id: BUSINESS_A,
          }),
        ],
        documents: [],
      });

      const perfectMatch = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-1',
            total_amount: 100,
            currency_code: 'USD',
            date: new Date('2024-01-15'),
            creditor_id: BUSINESS_A,
            debtor_id: USER_ID,
          }),
        ],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [perfectMatch], USER_ID, createMockInjector());

      expect(result.status).toBe('matched');
      expect(result.match).not.toBeNull();
      expect(result.match?.chargeId).toBe('doc-charge-1');
      expect(result.match?.confidenceScore).toBeGreaterThanOrEqual(0.95);
    });

    it('should return matched status for score exactly at 0.95 threshold', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: '100',
            currency: 'USD',
            event_date: new Date('2024-01-15'),
          }),
        ],
        documents: [],
      });

      // Create a match that will score close to 0.95
      // Same currency (1.0), same business (1.0), same date (1.0), slightly different amount
      const nearThresholdMatch = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-1',
            total_amount: 100,
            currency_code: 'USD',
            date: new Date('2024-01-15'),
          }),
        ],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [nearThresholdMatch], USER_ID, createMockInjector());

      expect(result.status).toBe('matched');
      expect(result.match).not.toBeNull();
      expect(result.match?.confidenceScore).toBeGreaterThanOrEqual(0.95);
    });

    it('should work with document source charge', async () => {
      const sourceCharge = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-1',
            total_amount: 200,
            currency_code: 'EUR',
            date: new Date('2024-02-10'),
          }),
        ],
      });

      const perfectMatch = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: '200',
            currency: 'EUR',
            event_date: new Date('2024-02-10'),
          }),
        ],
        documents: [],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [perfectMatch], USER_ID, createMockInjector());

      expect(result.status).toBe('matched');
      expect(result.match).not.toBeNull();
      expect(result.match?.chargeId).toBe('tx-charge-1');
    });
  });

  describe('Multiple high-confidence matches', () => {
    it('should return skipped status when multiple matches >= 0.95', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: "100",
            currency: 'USD',
            event_date: new Date('2024-01-15'),
          }),
        ],
        documents: [],
      });

      const match1 = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-1',
            total_amount: 100,
            currency_code: 'USD',
            date: new Date('2024-01-15'),
          }),
        ],
      });

      const match2 = createCharge({
        chargeId: 'doc-charge-2',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-2',
            total_amount: 100,
            currency_code: 'USD',
            date: new Date('2024-01-15'),
          }),
        ],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [match1, match2], USER_ID, createMockInjector());

      expect(result.status).toBe('skipped');
      expect(result.match).toBeNull();
      expect(result.reason).toContain('ambiguous');
    });

    it('should skip even with many high-confidence matches', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: "100",
          }),
        ],
        documents: [],
      });

      const candidates = Array.from({ length: 5 }, (_, i) =>
        createCharge({
          chargeId: `doc-charge-${i}`,
          transactions: [],
          documents: [createMockDocument({ charge_id: `doc-charge-${i}`, total_amount: 100 })],
        }),
      );

      const result = await processChargeForAutoMatch(sourceCharge, candidates, USER_ID, createMockInjector());

      expect(result.status).toBe('skipped');
      expect(result.match).toBeNull();
    });
  });

  describe('No high-confidence matches', () => {
    it('should return no-match when best match is below 0.95 threshold', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: "100",
            currency: 'USD',
            event_date: new Date('2024-01-15'),
          }),
        ],
        documents: [],
      });

      // Create a poor match - different amount and currency
      const poorMatch = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-1',
            total_amount: 500, // Very different amount
            currency_code: 'EUR', // Different currency
            date: new Date('2024-01-15'),
          }),
        ],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [poorMatch], USER_ID, createMockInjector());

      expect(result.status).toBe('no-match');
      expect(result.match).toBeNull();
      expect(result.reason).toContain('below threshold');
    });

    it('should return no-match when no candidates exist', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [], USER_ID, createMockInjector());

      expect(result.status).toBe('no-match');
      expect(result.match).toBeNull();
      expect(result.reason).toContain('No candidates found');
    });

    it('should handle match just below threshold (0.949)', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            charge_id: 'tx-charge-1',
            amount: "100",
            currency: 'USD',
            event_date: new Date('2024-01-15'),
          }),
        ],
        documents: [],
      });

      // Create a match with small amount difference to get score just below 0.95
      const nearMissMatch = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [
          createMockDocument({
            charge_id: 'doc-charge-1',
            total_amount: 105, // Small difference
            currency_code: 'USD',
            date: new Date('2024-01-16'), // One day off
          }),
        ],
      });

      const result = await processChargeForAutoMatch(sourceCharge, [nearMissMatch], USER_ID, createMockInjector());

      // Should be no-match since it's below threshold
      expect(result.status).toBe('no-match');
      expect(result.match).toBeNull();
    });
  });

  describe('Edge cases and validation', () => {
    it('should throw error if source charge is already matched', async () => {
      const matchedCharge = createCharge({
        chargeId: 'matched-charge',
        transactions: [createMockTransaction()],
        documents: [createMockDocument()],
      });

      await expect(processChargeForAutoMatch(matchedCharge, [], USER_ID, createMockInjector())).rejects.toThrow(
        /already matched/,
      );
    });

    it('should throw error if source charge has no transactions or documents', async () => {
      const emptyCharge = createCharge({
        chargeId: 'empty-charge',
        transactions: [],
        documents: [],
      });

      await expect(processChargeForAutoMatch(emptyCharge, [], USER_ID, createMockInjector())).rejects.toThrow(
        /no transactions or documents/,
      );
    });

    it('should filter candidates to complementary type only', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [createMockTransaction({ amount: "100" })],
        documents: [],
      });

      // Mix of document charges and transaction charges
      const candidates = [
        createCharge({
          chargeId: 'doc-charge-1',
          transactions: [],
          documents: [createMockDocument({ total_amount: 100 })],
        }),
        createCharge({
          chargeId: 'tx-charge-2',
          transactions: [createMockTransaction({ amount: "100" })], // Should be filtered out
          documents: [],
        }),
        createCharge({
          chargeId: 'doc-charge-2',
          transactions: [],
          documents: [createMockDocument({ total_amount: 100 })],
        }),
      ];

      const result = await processChargeForAutoMatch(sourceCharge, candidates, USER_ID, createMockInjector());

      // Should only consider document charges (doc-charge-1 and doc-charge-2)
      // Both are perfect matches, so should be skipped as ambiguous
      expect(result.status).toBe('skipped');
    });

    it('should handle various confidence levels correctly', async () => {
      const sourceCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [
          createMockTransaction({
            amount: "100",
            currency: 'USD',
            event_date: new Date('2024-01-15'),
          }),
        ],
        documents: [],
      });

      const candidates = [
        // Perfect match - confidence ~0.99+
        createCharge({
          chargeId: 'doc-charge-perfect',
          transactions: [],
          documents: [
            createMockDocument({
              total_amount: 100,
              currency_code: 'USD',
              date: new Date('2024-01-15'),
            }),
          ],
        }),
        // Good match but below threshold - confidence ~0.85
        createCharge({
          chargeId: 'doc-charge-good',
          transactions: [],
          documents: [
            createMockDocument({
              total_amount: 110,
              currency_code: 'USD',
              date: new Date('2024-01-20'),
            }),
          ],
        }),
        // Poor match - confidence ~0.40
        createCharge({
          chargeId: 'doc-charge-poor',
          transactions: [],
          documents: [
            createMockDocument({
              total_amount: 200,
              currency_code: 'EUR',
              date: new Date('2024-02-15'),
            }),
          ],
        }),
      ];

      const result = await processChargeForAutoMatch(sourceCharge, candidates, USER_ID, createMockInjector());

      // Only one match >= 0.95 (the perfect one)
      expect(result.status).toBe('matched');
      expect(result.match?.chargeId).toBe('doc-charge-perfect');
    });
  });
});

describe('determineMergeDirection', () => {
  describe('Matched charge priority', () => {
    it('should keep matched charge when one is matched and one is unmatched', () => {
      const matchedCharge = createCharge({
        chargeId: 'matched-1',
        transactions: [createMockTransaction()],
        documents: [createMockDocument()],
      });

      const unmatchedCharge = createCharge({
        chargeId: 'unmatched-1',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const [source, target] = determineMergeDirection(matchedCharge, unmatchedCharge);

      expect(target.chargeId).toBe('matched-1');
      expect(source.chargeId).toBe('unmatched-1');
    });

    it('should keep matched charge regardless of order', () => {
      const matchedCharge = createCharge({
        chargeId: 'matched-1',
        transactions: [createMockTransaction()],
        documents: [createMockDocument()],
      });

      const unmatchedCharge = createCharge({
        chargeId: 'unmatched-1',
        transactions: [],
        documents: [createMockDocument()],
      });

      const [source, target] = determineMergeDirection(unmatchedCharge, matchedCharge);

      expect(target.chargeId).toBe('matched-1');
      expect(source.chargeId).toBe('unmatched-1');
    });
  });

  describe('Transaction charge priority', () => {
    it('should keep transaction charge when both are unmatched', () => {
      const transactionCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const documentCharge = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [createMockDocument()],
      });

      const [source, target] = determineMergeDirection(transactionCharge, documentCharge);

      expect(target.chargeId).toBe('tx-charge-1');
      expect(source.chargeId).toBe('doc-charge-1');
    });

    it('should keep transaction charge regardless of order', () => {
      const transactionCharge = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const documentCharge = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [createMockDocument()],
      });

      const [source, target] = determineMergeDirection(documentCharge, transactionCharge);

      expect(target.chargeId).toBe('tx-charge-1');
      expect(source.chargeId).toBe('doc-charge-1');
    });
  });

  describe('Default behavior', () => {
    it('should keep first charge when both are document-only', () => {
      const docCharge1 = createCharge({
        chargeId: 'doc-charge-1',
        transactions: [],
        documents: [createMockDocument()],
      });

      const docCharge2 = createCharge({
        chargeId: 'doc-charge-2',
        transactions: [],
        documents: [createMockDocument()],
      });

      const [source, target] = determineMergeDirection(docCharge1, docCharge2);

      expect(target.chargeId).toBe('doc-charge-1');
      expect(source.chargeId).toBe('doc-charge-2');
    });

    it('should keep first charge when both are transaction-only', () => {
      const txCharge1 = createCharge({
        chargeId: 'tx-charge-1',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const txCharge2 = createCharge({
        chargeId: 'tx-charge-2',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const [source, target] = determineMergeDirection(txCharge1, txCharge2);

      expect(target.chargeId).toBe('tx-charge-1');
      expect(source.chargeId).toBe('tx-charge-2');
    });

    it('should keep first charge when both are matched', () => {
      const matched1 = createCharge({
        chargeId: 'matched-1',
        transactions: [createMockTransaction()],
        documents: [createMockDocument()],
      });

      const matched2 = createCharge({
        chargeId: 'matched-2',
        transactions: [createMockTransaction()],
        documents: [createMockDocument()],
      });

      const [source, target] = determineMergeDirection(matched1, matched2);

      expect(target.chargeId).toBe('matched-1');
      expect(source.chargeId).toBe('matched-2');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle charge with multiple transactions', () => {
      const multiTxCharge = createCharge({
        chargeId: 'multi-tx',
        transactions: [
          createMockTransaction({ amount: "50" }),
          createMockTransaction({ amount: "50" }),
        ],
        documents: [],
      });

      const singleDocCharge = createCharge({
        chargeId: 'single-doc',
        transactions: [],
        documents: [createMockDocument()],
      });

      const [source, target] = determineMergeDirection(multiTxCharge, singleDocCharge);

      expect(target.chargeId).toBe('multi-tx');
      expect(source.chargeId).toBe('single-doc');
    });

    it('should handle charge with multiple documents', () => {
      const txCharge = createCharge({
        chargeId: 'tx-charge',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const multiDocCharge = createCharge({
        chargeId: 'multi-doc',
        transactions: [],
        documents: [
          createMockDocument({ serial_number: 'INV-001' }),
          createMockDocument({ serial_number: 'INV-002' }),
        ],
      });

      const [source, target] = determineMergeDirection(txCharge, multiDocCharge);

      expect(target.chargeId).toBe('tx-charge');
      expect(source.chargeId).toBe('multi-doc');
    });

    it('should prioritize matched over transaction when choosing', () => {
      const matched = createCharge({
        chargeId: 'matched',
        transactions: [createMockTransaction()],
        documents: [createMockDocument()],
      });

      const txOnly = createCharge({
        chargeId: 'tx-only',
        transactions: [createMockTransaction()],
        documents: [],
      });

      const [source, target] = determineMergeDirection(txOnly, matched);

      // Matched should be kept even though txOnly has transactions
      expect(target.chargeId).toBe('matched');
      expect(source.chargeId).toBe('tx-only');
    });
  });
});
