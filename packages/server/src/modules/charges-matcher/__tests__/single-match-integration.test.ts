import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Document, Transaction } from '../types.js';

// Mock the module imports to avoid dependency issues
vi.mock('graphql-modules', () => ({
  Injectable: () => (target: any) => target,
  Inject: () => (target: any, propertyKey: string | symbol, parameterIndex: number) => {},
  Injector: class {},
  Scope: { Operation: 'Operation' },
  CONTEXT: Symbol('CONTEXT'),
}));

vi.mock('@modules/charges/providers/charges.provider.js', () => ({
  ChargesProvider: class {},
}));

vi.mock('@modules/documents/providers/documents.provider.js', () => ({
  DocumentsProvider: class {},
}));

vi.mock('@modules/transactions/providers/transactions.provider.js', () => ({
  TransactionsProvider: class {},
}));

vi.mock('@shared/helpers', () => ({
  dateToTimelessDateString: (date: Date) => date.toISOString().split('T')[0],
}));

// Import after mocking
const { ChargesMatcherProvider } = await import('../providers/charges-matcher.provider.js');

type Injector = {
  get: (token: any) => any;
};

// Test constants
const ADMIN_BUSINESS_ID = 'user-123';
const BUSINESS_A = 'business-a';
const BUSINESS_B = 'business-b';

// Helper to create transaction
function createTransaction(overrides: Partial<any> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    charge_id: 'charge-tx',
    amount: "100",
    currency: 'USD',
    business_id: BUSINESS_A,
    event_date: new Date('2024-01-15'),
    debit_date: new Date('2024-01-16'),
    debit_timestamp: new Date('2024-01-16T10:00:00'),
    source_description: 'Test transaction',
    is_fee: false,
    account_id: 'account-1',
    source_id: 'source-1',
    source_origin: null,
    current_balance: null,
    ...overrides,
  } as Transaction;
}

// Helper to create document
function createDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: `doc-${Math.random()}`,
    charge_id: 'charge-doc',
    creditor_id: BUSINESS_A,
    debtor_id: ADMIN_BUSINESS_ID,
    currency_code: 'USD',
    total_amount: 100,
    date: new Date('2024-01-15'),
    serial_number: 'INV-001',
    type: 'INVOICE',
    image_url: null,
    file_url: null,
    ...overrides,
  } as Document;
}

// Mock charge object
function createCharge(id: string, ownerId: string) {
  return {
    id,
    owner_id: ownerId,
    transactions_min_event_date: new Date('2024-01-15'),
    transactions_max_event_date: new Date('2024-01-15'),
  };
}

describe('ChargesMatcherProvider - Integration Tests', () => {
  describe('findMatchesForCharge', () => {
    it('should find matches for transaction charge with mock data', async () => {
      // Setup mock data
      const sourceChargeId = 'tx-charge-1';
      const sourceTransactions = [
        createTransaction({
          charge_id: sourceChargeId,
          amount: 100,
          currency: 'USD',
          event_date: new Date('2024-01-15'),
        }),
      ];

      const candidateCharge1Id = 'doc-charge-1';
      const candidateDocuments1 = [
        createDocument({
          charge_id: candidateCharge1Id,
          total_amount: 100,
          currency_code: 'USD',
          date: new Date('2024-01-15'),
        }),
      ];

      const candidateCharge2Id = 'doc-charge-2';
      const candidateDocuments2 = [
        createDocument({
          charge_id: candidateCharge2Id,
          total_amount: 110,
          currency_code: 'USD',
          date: new Date('2024-01-16'),
        }),
      ];

      // Mock providers
      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve(createCharge(id, ADMIN_BUSINESS_ID));
            if (id === candidateCharge1Id) return Promise.resolve(createCharge(id, ADMIN_BUSINESS_ID));
            if (id === candidateCharge2Id) return Promise.resolve(createCharge(id, ADMIN_BUSINESS_ID));
            return Promise.resolve(new Error('Charge not found'));
          }),
        },
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(candidateCharge1Id, ADMIN_BUSINESS_ID),
            createCharge(candidateCharge2Id, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve(sourceTransactions);
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve([]);
            if (id === candidateCharge1Id) return Promise.resolve(candidateDocuments1);
            if (id === candidateCharge2Id) return Promise.resolve(candidateDocuments2);
            return Promise.resolve([]);
          }),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      // Execute
      const provider = new ChargesMatcherProvider();
      const result = await provider.findMatchesForCharge(sourceChargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any);

      // Verify
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].chargeId).toBe(candidateCharge1Id); // Perfect match
      expect(result.matches[0].confidenceScore).toBeGreaterThan(0.95);
      expect(result.matches[1].chargeId).toBe(candidateCharge2Id); // Partial match
      expect(result.matches[1].confidenceScore).toBeLessThan(0.95);
    });

    it('should find matches for document charge with mock data', async () => {
      // Setup mock data
      const sourceChargeId = 'doc-charge-1';
      const sourceDocuments = [
        createDocument({
          charge_id: sourceChargeId,
          total_amount: 200,
          currency_code: 'USD',
          date: new Date('2024-02-15'),
        }),
      ];

      const candidateCharge1Id = 'tx-charge-1';
      const candidateTransactions1 = [
        createTransaction({
          charge_id: candidateCharge1Id,
          amount: 200,
          currency: 'USD',
          event_date: new Date('2024-02-15'),
        }),
      ];

      const candidateCharge2Id = 'tx-charge-2';
      const candidateTransactions2 = [
        createTransaction({
          charge_id: candidateCharge2Id,
          amount: 195,
          currency: 'USD',
          event_date: new Date('2024-02-16'),
        }),
      ];

      // Mock providers
      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve(createCharge(id, ADMIN_BUSINESS_ID));
            return Promise.resolve(createCharge(id, ADMIN_BUSINESS_ID));
          }),
        },
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(candidateCharge1Id, ADMIN_BUSINESS_ID),
            createCharge(candidateCharge2Id, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === candidateCharge1Id) return Promise.resolve(candidateTransactions1);
            if (id === candidateCharge2Id) return Promise.resolve(candidateTransactions2);
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve(sourceDocuments);
            return Promise.resolve([]);
          }),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      // Execute
      const provider = new ChargesMatcherProvider();
      const result = await provider.findMatchesForCharge(sourceChargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any);

      // Verify
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].chargeId).toBe(candidateCharge1Id);
      expect(result.matches[0].confidenceScore).toBeGreaterThan(0.95);
    });

    it('should throw error if charge not found', async () => {
      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(new Error('Not found'))),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();

      await expect(
        provider.findMatchesForCharge('non-existent', { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any),
      ).rejects.toThrow(/Source charge not found/);
    });

    it('should throw error if charge is already matched', async () => {
      const chargeId = 'matched-charge';

      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(createCharge(chargeId, ADMIN_BUSINESS_ID))),
        },
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn(() => Promise.resolve([createTransaction()])),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn(() => Promise.resolve([createDocument()])),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();

      await expect(provider.findMatchesForCharge(chargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any)).rejects.toThrow(
        /already matched/,
      );
    });

    it('should throw error if charge has no transactions or documents', async () => {
      const chargeId = 'empty-charge';

      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(createCharge(chargeId, ADMIN_BUSINESS_ID))),
        },
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn(() => Promise.resolve([])),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn(() => Promise.resolve([])),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();

      await expect(provider.findMatchesForCharge(chargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any)).rejects.toThrow(
        /no transactions or documents/,
      );
    });

    it('should return empty matches if no candidates found', async () => {
      const sourceChargeId = 'tx-charge-only';

      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(createCharge(sourceChargeId, ADMIN_BUSINESS_ID))),
        },
        getChargesByFilters: vi.fn(() => Promise.resolve([])),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn(() => Promise.resolve([createTransaction()])),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn(() => Promise.resolve([])),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();
      const result = await provider.findMatchesForCharge(sourceChargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any);

      expect(result.matches).toEqual([]);
    });

    it('should filter out matched candidates (having both transactions and documents)', async () => {
      const sourceChargeId = 'tx-charge-1';
      const matchedCandidateId = 'matched-charge';
      const validCandidateId = 'doc-charge-1';

      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(createCharge(sourceChargeId, ADMIN_BUSINESS_ID))),
        },
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(matchedCandidateId, ADMIN_BUSINESS_ID),
            createCharge(validCandidateId, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve([createTransaction()]);
            if (id === matchedCandidateId) return Promise.resolve([createTransaction()]); // Has transactions
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === matchedCandidateId) return Promise.resolve([createDocument()]); // Also has documents - MATCHED
            if (id === validCandidateId) return Promise.resolve([createDocument()]); // Only documents - VALID
            return Promise.resolve([]);
          }),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();
      const result = await provider.findMatchesForCharge(sourceChargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any);

      // Should only include validCandidateId, not matchedCandidateId
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].chargeId).toBe(validCandidateId);
    });

    it('should handle date window filtering correctly', async () => {
      const sourceChargeId = 'tx-charge-1';
      const sourceDate = new Date('2024-06-15');

      const withinWindowId = 'doc-charge-within';
      const outsideWindowId = 'doc-charge-outside';

      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(createCharge(sourceChargeId, ADMIN_BUSINESS_ID))),
        },
        getChargesByFilters: vi.fn(params => {
          // Verify date window parameters
          expect(params.fromAnyDate).toBeDefined();
          expect(params.toAnyDate).toBeDefined();
          return Promise.resolve([
            createCharge(withinWindowId, ADMIN_BUSINESS_ID),
            createCharge(outsideWindowId, ADMIN_BUSINESS_ID),
          ]);
        }),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) {
              return Promise.resolve([createTransaction({ event_date: sourceDate })]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve([]);
            if (id === withinWindowId) {
              // Within 12-month window
              return Promise.resolve([
                createDocument({ date: new Date('2024-06-20') }),
              ]);
            }
            if (id === outsideWindowId) {
              // Outside 12-month window
              return Promise.resolve([
                createDocument({ date: new Date('2025-07-15') }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();
      const result = await provider.findMatchesForCharge(sourceChargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any);

      // Should only include candidate within window
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].chargeId).toBe(withinWindowId);
    });

    it('should throw error if user ID not in context', async () => {
      const mockInjector = {
        get: vi.fn(() => null), // No user
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();

      await expect(provider.findMatchesForCharge('any-id', { adminContext: { defaultAdminBusinessId: null }, injector: mockInjector } as any)).rejects.toThrow(
        /Admin business not found in context/,
      );
    });

    it('should return top 5 matches when more candidates exist', async () => {
      const sourceChargeId = 'tx-charge-1';

      // Create 7 candidate charges
      const candidateIds = Array.from({ length: 7 }, (_, i) => `doc-charge-${i + 1}`);

      const mockChargesProvider = {
        getChargeByIdLoader: {
          load: vi.fn(() => Promise.resolve(createCharge(sourceChargeId, ADMIN_BUSINESS_ID))),
        },
        getChargesByFilters: vi.fn(() =>
          Promise.resolve(candidateIds.map(id => createCharge(id, ADMIN_BUSINESS_ID))),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) {
              return Promise.resolve([createTransaction({ amount: 100 })]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === sourceChargeId) return Promise.resolve([]);
            // Create documents with varying amounts for different confidence scores
            const index = parseInt(id.split('-')[2]);
            return Promise.resolve([createDocument({ total_amount: 100 + index })]);
          }),
        },
      };

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();
      const result = await provider.findMatchesForCharge(sourceChargeId, { adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID }, injector: mockInjector } as any);

      // Should return maximum of 5 matches
      expect(result.matches).toHaveLength(5);
      // Verify sorted by confidence (descending)
      for (let i = 0; i < result.matches.length - 1; i++) {
        expect(result.matches[i].confidenceScore).toBeGreaterThanOrEqual(
          result.matches[i + 1].confidenceScore,
        );
      }
    });
  });
});
