import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Document, Transaction } from '../types.js';

// Mock the module imports
vi.mock('graphql-modules', () => ({
  Injectable: () => (target: any) => target,
  Injector: class {},
  Scope: { Operation: 'Operation' },
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

vi.mock('@modules/charges/helpers/merge-charges.hepler.js', () => ({
  mergeChargesExecutor: vi.fn(),
}));

vi.mock('@shared/helpers', () => ({
  dateToTimelessDateString: (date: Date) => date.toISOString().split('T')[0],
}));

// Import after mocking
const { ChargesMatcherProvider } = await import('../providers/charges-matcher.provider.js');
const { mergeChargesExecutor } = await import(
  '@modules/charges/helpers/merge-charges.hepler.js'
);

type Injector = {
  get: (token: any) => any;
};

// Test constants
const ADMIN_BUSINESS_ID = 'admin-123';
const BUSINESS_A = 'business-a';

// Helper to create transaction
function createTransaction(overrides: Partial<any> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    charge_id: 'charge-tx',
    amount: 100,
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

// Helper to create charge
function createCharge(id: string, ownerId: string) {
  return {
    id,
    owner_id: ownerId,
  };
}

describe('ChargesMatcherProvider - Auto-Match Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('autoMatchCharges', () => {
    it('should return 0 matches when database is empty', async () => {
      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() => Promise.resolve([])),
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
      const result = await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      expect(result.totalMatches).toBe(0);
      expect(result.mergedCharges).toEqual([]);
      expect(result.skippedCharges).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should return 0 matches when all charges are already matched', async () => {
      const matchedChargeId = 'matched-charge-1';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([createCharge(matchedChargeId, ADMIN_BUSINESS_ID)]),
        ),
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
      const result = await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      expect(result.totalMatches).toBe(0);
      expect(result.mergedCharges).toEqual([]);
      expect(result.skippedCharges).toEqual([]);
    });

    it('should execute merge for single unmatched charge with good match', async () => {
      const txChargeId = 'tx-charge-1';
      const docChargeId = 'doc-charge-1';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(txChargeId, ADMIN_BUSINESS_ID),
            createCharge(docChargeId, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === txChargeId) {
              return Promise.resolve([
                createTransaction({
                  charge_id: txChargeId,
                  amount: 100,
                  currency: 'USD',
                  event_date: new Date('2024-01-15'),
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === docChargeId) {
              return Promise.resolve([
                createDocument({
                  charge_id: docChargeId,
                  total_amount: 100,
                  currency_code: 'USD',
                  date: new Date('2024-01-15'),
                }),
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
      const result = await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      expect(result.totalMatches).toBe(1);
      expect(result.mergedCharges).toHaveLength(1);
      expect(result.mergedCharges[0].confidenceScore).toBeGreaterThanOrEqual(0.95);
      expect(result.skippedCharges).toEqual([]);
      expect(result.errors).toEqual([]);

      // Verify merge was called
      expect(mergeChargesExecutor).toHaveBeenCalledTimes(1);
    });

    it('should skip charges with ambiguous matches', async () => {
      const txChargeId = 'tx-charge-1';
      const docCharge1Id = 'doc-charge-1';
      const docCharge2Id = 'doc-charge-2';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(txChargeId, ADMIN_BUSINESS_ID),
            createCharge(docCharge1Id, ADMIN_BUSINESS_ID),
            createCharge(docCharge2Id, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === txChargeId) {
              return Promise.resolve([
                createTransaction({
                  charge_id: txChargeId,
                  amount: 100,
                  currency: 'USD',
                  event_date: new Date('2024-01-15'),
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === docCharge1Id) {
              return Promise.resolve([
                createDocument({
                  charge_id: docCharge1Id,
                  total_amount: 100,
                  currency_code: 'USD',
                  date: new Date('2024-01-15'),
                }),
              ]);
            }
            if (id === docCharge2Id) {
              return Promise.resolve([
                createDocument({
                  charge_id: docCharge2Id,
                  total_amount: 100,
                  currency_code: 'USD',
                  date: new Date('2024-01-15'),
                }),
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
      const result = await provider.autoMatchCharges( {
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      // The transaction charge should find 2 identical doc matches and skip (ambiguous)
      // But the doc charges will also match each other with high confidence
      // Since processing is sequential, one doc will match the other doc
      // So we expect: 1 match (doc1-doc2), and tx skipped due to ambiguity
      expect(result.totalMatches).toBe(1);
      expect(result.skippedCharges).toHaveLength(1);
      expect(result.skippedCharges[0]).toBe(txChargeId);
      expect(mergeChargesExecutor).toHaveBeenCalledTimes(1);
    });

    it('should process multiple unmatched charges correctly', async () => {
      const tx1Id = 'tx-charge-1';
      const doc1Id = 'doc-charge-1';
      const tx2Id = 'tx-charge-2';
      const doc2Id = 'doc-charge-2';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(tx1Id, ADMIN_BUSINESS_ID),
            createCharge(doc1Id, ADMIN_BUSINESS_ID),
            createCharge(tx2Id, ADMIN_BUSINESS_ID),
            createCharge(doc2Id, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === tx1Id) {
              return Promise.resolve([
                createTransaction({ charge_id: tx1Id, amount: 100, currency: 'USD' }),
              ]);
            }
            if (id === tx2Id) {
              return Promise.resolve([
                createTransaction({ charge_id: tx2Id, amount: 200, currency: 'EUR' }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === doc1Id) {
              return Promise.resolve([
                createDocument({ charge_id: doc1Id, total_amount: 100, currency_code: 'USD' }),
              ]);
            }
            if (id === doc2Id) {
              return Promise.resolve([
                createDocument({ charge_id: doc2Id, total_amount: 200, currency_code: 'EUR' }),
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
      const result = await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      expect(result.totalMatches).toBe(2);
      expect(result.mergedCharges).toHaveLength(2);
      expect(mergeChargesExecutor).toHaveBeenCalledTimes(2);
    });

    it('should capture errors during merge but continue processing', async () => {
      const tx1Id = 'tx-charge-1';
      const doc1Id = 'doc-charge-1';
      const tx2Id = 'tx-charge-2'; // This will have no match

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(tx1Id, ADMIN_BUSINESS_ID),
            createCharge(doc1Id, ADMIN_BUSINESS_ID),
            createCharge(tx2Id, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === tx1Id) {
              return Promise.resolve([
                createTransaction({
                  charge_id: id,
                  amount: 100,
                  currency: 'USD',
                  event_date: new Date('2024-01-15'),
                }),
              ]);
            }
            if (id === tx2Id) {
              return Promise.resolve([
                createTransaction({
                  charge_id: id,
                  amount: 999,
                  currency: 'GBP',
                  event_date: new Date('2024-03-15'),
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === doc1Id) {
              return Promise.resolve([
                createDocument({
                  charge_id: id,
                  total_amount: 100,
                  currency_code: 'USD',
                  date: new Date('2024-01-15'),
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      // Mock merge to fail on first call, succeed on second
      (mergeChargesExecutor as any).mockImplementationOnce(() => {
        throw new Error('Merge failed for test');
      });
      (mergeChargesExecutor as any).mockImplementationOnce(() => Promise.resolve());

      const mockInjector = {
        get: vi.fn((token: any) => {
          if (token.name === 'ChargesProvider') return mockChargesProvider;
          if (token.name === 'TransactionsProvider') return mockTransactionsProvider;
          if (token.name === 'DocumentsProvider') return mockDocumentsProvider;
          return null;
        }),
      } as unknown as Injector;

      const provider = new ChargesMatcherProvider();
      const result = await provider.autoMatchCharges( {
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      // tx1 finds doc1, merge fails → error captured, charges not marked as merged
      // doc1 finds tx1, merge succeeds → totalMatches++, charges marked as merged
      // tx2 has no match → silent
      expect(result.totalMatches).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to merge');
      expect(mergeChargesExecutor).toHaveBeenCalledTimes(2);
    });

    it('should verify merge direction keeps transaction charge', async () => {
      const txChargeId = 'tx-charge-1';
      const docChargeId = 'doc-charge-1';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(txChargeId, ADMIN_BUSINESS_ID),
            createCharge(docChargeId, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === txChargeId) {
              return Promise.resolve([createTransaction({ charge_id: txChargeId })]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === docChargeId) {
              return Promise.resolve([createDocument({ charge_id: docChargeId })]);
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
      await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      // Verify merge was called with doc charge being merged into tx charge
      expect(mergeChargesExecutor).toHaveBeenCalledWith([docChargeId], txChargeId, mockInjector);
    });

    it('should exclude merged charges from further processing in same run', async () => {
      const tx1Id = 'tx-charge-1';
      const doc1Id = 'doc-charge-1';
      const tx2Id = 'tx-charge-2';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(tx1Id, ADMIN_BUSINESS_ID),
            createCharge(doc1Id, ADMIN_BUSINESS_ID),
            createCharge(tx2Id, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === tx1Id || id === tx2Id) {
              return Promise.resolve([createTransaction({ charge_id: id, amount: 100 })]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === doc1Id) {
              return Promise.resolve([createDocument({ charge_id: doc1Id, total_amount: 100 })]);
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
      const result = await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      // Should only merge tx1 with doc1, tx2 should have no match
      expect(result.totalMatches).toBe(1);
      expect(mergeChargesExecutor).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed scenarios: some match, some skip, some no-match', async () => {
      const perfectMatchTx = 'tx-perfect';
      const perfectMatchDoc = 'doc-perfect';
      const ambiguousTx = 'tx-ambiguous';
      const ambiguousDoc1 = 'doc-ambiguous-1';
      const ambiguousDoc2 = 'doc-ambiguous-2';
      const noMatchTx = 'tx-no-match';

      const mockChargesProvider = {
        getChargesByFilters: vi.fn(() =>
          Promise.resolve([
            createCharge(perfectMatchTx, ADMIN_BUSINESS_ID),
            createCharge(perfectMatchDoc, ADMIN_BUSINESS_ID),
            createCharge(ambiguousTx, ADMIN_BUSINESS_ID),
            createCharge(ambiguousDoc1, ADMIN_BUSINESS_ID),
            createCharge(ambiguousDoc2, ADMIN_BUSINESS_ID),
            createCharge(noMatchTx, ADMIN_BUSINESS_ID),
          ]),
        ),
      };

      const mockTransactionsProvider = {
        transactionsByChargeIDLoader: {
          load: vi.fn((id: string) => {
            if (id === perfectMatchTx) {
              return Promise.resolve([
                createTransaction({
                  charge_id: id,
                  amount: 100,
                  currency: 'USD',
                  event_date: new Date('2024-01-15'),
                }),
              ]);
            }
            if (id === ambiguousTx) {
              return Promise.resolve([
                createTransaction({
                  charge_id: id,
                  amount: 200,
                  currency: 'EUR',
                  event_date: new Date('2024-02-15'),
                }),
              ]);
            }
            if (id === noMatchTx) {
              return Promise.resolve([
                createTransaction({
                  charge_id: id,
                  amount: 500,
                  currency: 'GBP',
                  event_date: new Date('2024-03-15'),
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const mockDocumentsProvider = {
        getDocumentsByChargeIdLoader: {
          load: vi.fn((id: string) => {
            if (id === perfectMatchDoc) {
              return Promise.resolve([
                createDocument({
                  charge_id: id,
                  total_amount: 100,
                  currency_code: 'USD',
                  date: new Date('2024-01-15'),
                }),
              ]);
            }
            if (id === ambiguousDoc1) {
              return Promise.resolve([
                createDocument({
                  charge_id: id,
                  total_amount: 200,
                  currency_code: 'EUR',
                  date: new Date('2024-02-15'),
                  vat_amount: 10, // Different VAT
                }),
              ]);
            }
            if (id === ambiguousDoc2) {
              return Promise.resolve([
                createDocument({
                  charge_id: id,
                  total_amount: 200,
                  currency_code: 'EUR',
                  date: new Date('2024-02-15'),
                  vat_amount: 20, // Different VAT - but this won't affect matching score
                }),
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

      (mergeChargesExecutor as any).mockImplementation(() => Promise.resolve());

      const provider = new ChargesMatcherProvider();
      const result = await provider.autoMatchCharges({
        adminContext: { defaultAdminBusinessId: ADMIN_BUSINESS_ID },
        injector: mockInjector,
      } as any);

      // Expected results:
      // - perfectMatchTx finds perfectMatchDoc → merge (1)
      // - perfectMatchDoc → already merged, skip processing
      // - ambiguousTx finds 2 docs (ambiguousDoc1, ambiguousDoc2) → skipped due to ambiguity
      // - ambiguousDoc1 finds ambiguousDoc2 (tx was skipped, not merged) → merge (2)
      // - ambiguousDoc2 → already merged, skip processing
      // - noMatchTx → no match, silent
      // Total: 2 successful matches, 1 skipped charge (tx-ambiguous)
      expect(result.totalMatches).toBe(2);
      expect(result.mergedCharges).toHaveLength(2);
      expect(result.skippedCharges).toHaveLength(1);
      expect(result.skippedCharges[0]).toBe(ambiguousTx);
      expect(mergeChargesExecutor).toHaveBeenCalledTimes(2);
    });

    it('should throw error if admin business ID not found in context', async () => {
      const provider = new ChargesMatcherProvider();

      await expect(
        provider.autoMatchCharges({
          adminContext: { defaultAdminBusinessId: null },
        } as any),
      ).rejects.toThrow(/Admin business not found/);
    });
  });
});
