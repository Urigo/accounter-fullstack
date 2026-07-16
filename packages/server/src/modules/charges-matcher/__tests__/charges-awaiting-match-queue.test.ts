import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { BY_SCORE_EVALUATION_CAP } from '../helpers/awaiting-match-queue.helper.js';
import { QueueMatchEvaluatorProvider } from '../providers/queue-match-evaluator.provider.js';
import { chargesAwaitingMatchQueueResolver } from '../resolvers/charges-awaiting-match-queue.resolver.js';
import type { ChargeMatchProto } from '../types.js';

const OWNER_ID = 'owner-1';

/**
 * Minimal enriched charge row, as returned by ChargesProvider.getChargesByFilters.
 * Count aggregates are int8 columns, surfaced as strings.
 */
function makeCharge(
  id: string,
  {
    transactions = 0,
    invoices = 0,
    receipts = 0,
  }: { transactions?: number; invoices?: number; receipts?: number } = {},
) {
  return {
    id,
    owner_id: OWNER_ID,
    transactions_count: transactions ? String(transactions) : null,
    invoices_count: invoices ? String(invoices) : null,
    receipts_count: receipts ? String(receipts) : null,
    documents_count: invoices + receipts ? String(invoices + receipts) : null,
  };
}

const txCharge = (id: string) => makeCharge(id, { transactions: 1 });
const docCharge = (id: string) => makeCharge(id, { invoices: 1 });

type ResolverFn = (
  parent: unknown,
  args: Record<string, unknown>,
  context: { injector: Injector },
  info: unknown,
) => Promise<{ baseCharges: { baseCharge: { id: string }; suggestions: ChargeMatchProto[] }[]; totalCount: number }>;

const resolve = chargesAwaitingMatchQueueResolver.Query!
  .chargesAwaitingMatchQueue as unknown as ResolverFn;

function createTestContext({
  charges,
  suggestionsById = {},
}: {
  charges: ReturnType<typeof makeCharge>[];
  suggestionsById?: Record<string, ChargeMatchProto[]>;
}) {
  const getChargesByFilters = vi.fn(async () => charges);
  const evaluateMatchesForCharges = vi.fn(async (baseCharges: { id: string }[]) =>
    baseCharges.map(baseCharge => ({
      baseCharge,
      suggestions: suggestionsById[baseCharge.id] ?? [],
    })),
  );

  const injector = {
    get: vi.fn((token: unknown) => {
      if (token === AdminContextProvider) {
        return { getVerifiedAdminContext: async () => ({ ownerId: OWNER_ID }) };
      }
      if (token === ChargesProvider) {
        return { getChargesByFilters };
      }
      if (token === QueueMatchEvaluatorProvider) {
        return { evaluateMatchesForCharges };
      }
      throw new Error(`Unexpected token requested from injector`);
    }),
  } as unknown as Injector;

  return { injector, getChargesByFilters, evaluateMatchesForCharges };
}

const baseArgs = {
  limit: 20,
  offset: 0,
  businessId: null,
  fromDate: null,
  toDate: null,
  mode: null,
  sortBy: 'BY_DATE',
};

describe('chargesAwaitingMatchQueue resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shared filtering', () => {
    it('should scope the DB fetch to the verified admin owner and pass filters through', async () => {
      const { injector, getChargesByFilters } = createTestContext({ charges: [] });

      await resolve(
        null,
        {
          ...baseArgs,
          businessId: 'business-7',
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
        },
        { injector },
        null,
      );

      expect(getChargesByFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerIds: [OWNER_ID],
          businessIds: ['business-7'],
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
        }),
      );
    });

    it('should include only unmatched charges (tx-only or doc-only) in the queue', async () => {
      const { injector } = createTestContext({
        charges: [
          txCharge('tx-1'),
          makeCharge('matched-1', { transactions: 1, receipts: 1 }),
          docCharge('doc-1'),
          makeCharge('empty-1'),
        ],
      });

      const result = await resolve(null, baseArgs, { injector }, null);

      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual(['tx-1', 'doc-1']);
      expect(result.totalCount).toBe(2);
    });

    it('should treat a transaction charge with invoice-only documents as unmatched', async () => {
      const { injector } = createTestContext({
        charges: [makeCharge('tx-with-invoice', { transactions: 1, invoices: 1 })],
      });

      const result = await resolve(null, baseArgs, { injector }, null);

      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual(['tx-with-invoice']);
    });

    it('should filter by DOC_BASE mode', async () => {
      const { injector } = createTestContext({
        charges: [txCharge('tx-1'), docCharge('doc-1'), docCharge('doc-2')],
      });

      const result = await resolve(null, { ...baseArgs, mode: 'DOC_BASE' }, { injector }, null);

      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual(['doc-1', 'doc-2']);
      expect(result.totalCount).toBe(2);
    });

    it('should filter by TRANSACTION_BASE mode', async () => {
      const { injector } = createTestContext({
        charges: [txCharge('tx-1'), docCharge('doc-1'), txCharge('tx-2')],
      });

      const result = await resolve(
        null,
        { ...baseArgs, mode: 'TRANSACTION_BASE' },
        { injector },
        null,
      );

      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual(['tx-1', 'tx-2']);
    });
  });

  describe('BY_DATE path', () => {
    it('should evaluate scores only for the requested page (limit + offset applied before scoring)', async () => {
      const charges = Array.from({ length: 10 }, (_, i) => txCharge(`charge-${i}`));
      const { injector, evaluateMatchesForCharges } = createTestContext({ charges });

      const result = await resolve(null, { ...baseArgs, limit: 3, offset: 4 }, { injector }, null);

      expect(evaluateMatchesForCharges).toHaveBeenCalledTimes(1);
      expect(
        (evaluateMatchesForCharges.mock.calls[0][0] as { id: string }[]).map(c => c.id),
      ).toEqual(['charge-4', 'charge-5', 'charge-6']);
      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual([
        'charge-4',
        'charge-5',
        'charge-6',
      ]);
      expect(result.totalCount).toBe(10);
    });

    it('should return different rows for subsequent pages', async () => {
      const charges = Array.from({ length: 6 }, (_, i) => txCharge(`charge-${i}`));
      const { injector } = createTestContext({ charges });

      const page1 = await resolve(null, { ...baseArgs, limit: 2, offset: 0 }, { injector }, null);
      const page2 = await resolve(null, { ...baseArgs, limit: 2, offset: 2 }, { injector }, null);

      expect(page1.baseCharges.map(c => c.baseCharge.id)).toEqual(['charge-0', 'charge-1']);
      expect(page2.baseCharges.map(c => c.baseCharge.id)).toEqual(['charge-2', 'charge-3']);
    });

    it('should return an empty page when offset exceeds the queue length', async () => {
      const { injector, evaluateMatchesForCharges } = createTestContext({
        charges: [txCharge('charge-0')],
      });

      const result = await resolve(null, { ...baseArgs, limit: 5, offset: 10 }, { injector }, null);

      expect(result.baseCharges).toEqual([]);
      expect(result.totalCount).toBe(1);
      expect(evaluateMatchesForCharges).toHaveBeenCalledWith([]);
    });
  });

  describe('BY_SCORE path', () => {
    it('should cap the evaluated window, sort by top suggestion score desc, then slice the page', async () => {
      const charges = Array.from({ length: BY_SCORE_EVALUATION_CAP + 50 }, (_, i) =>
        txCharge(`charge-${i}`),
      );
      const suggestionsById: Record<string, ChargeMatchProto[]> = {
        'charge-0': [{ chargeId: 'm-0', confidenceScore: 0.5 }],
        'charge-1': [{ chargeId: 'm-1', confidenceScore: 0.99 }],
        'charge-2': [{ chargeId: 'm-2', confidenceScore: 0.75 }],
      };
      const { injector, evaluateMatchesForCharges } = createTestContext({
        charges,
        suggestionsById,
      });

      const result = await resolve(
        null,
        { ...baseArgs, sortBy: 'BY_SCORE', limit: 3, offset: 0 },
        { injector },
        null,
      );

      // Evaluated exactly the capped window, in one call
      expect(evaluateMatchesForCharges).toHaveBeenCalledTimes(1);
      expect(evaluateMatchesForCharges.mock.calls[0][0]).toHaveLength(BY_SCORE_EVALUATION_CAP);
      // Highest scoring first
      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual([
        'charge-1',
        'charge-2',
        'charge-0',
      ]);
      // Pagination happens over the derived (capped) list
      expect(result.totalCount).toBe(BY_SCORE_EVALUATION_CAP);
    });

    it('should apply limit/offset AFTER sorting the whole evaluated window', async () => {
      const charges = Array.from({ length: 5 }, (_, i) => txCharge(`charge-${i}`));
      const suggestionsById: Record<string, ChargeMatchProto[]> = {
        'charge-0': [{ chargeId: 'm', confidenceScore: 0.1 }],
        'charge-1': [{ chargeId: 'm', confidenceScore: 0.9 }],
        'charge-2': [{ chargeId: 'm', confidenceScore: 0.5 }],
        'charge-3': [{ chargeId: 'm', confidenceScore: 0.7 }],
        'charge-4': [{ chargeId: 'm', confidenceScore: 0.3 }],
      };
      const { injector } = createTestContext({ charges, suggestionsById });

      const result = await resolve(
        null,
        { ...baseArgs, sortBy: 'BY_SCORE', limit: 2, offset: 2 },
        { injector },
        null,
      );

      // Sorted order: charge-1 (0.9), charge-3 (0.7), charge-2 (0.5), charge-4 (0.3), charge-0 (0.1)
      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual(['charge-2', 'charge-4']);
      expect(result.totalCount).toBe(5);
    });

    it('should rank charges without suggestions last, preserving recency order between them', async () => {
      const charges = [txCharge('charge-0'), txCharge('charge-1'), txCharge('charge-2')];
      const suggestionsById: Record<string, ChargeMatchProto[]> = {
        'charge-1': [{ chargeId: 'm', confidenceScore: 0.4 }],
      };
      const { injector } = createTestContext({ charges, suggestionsById });

      const result = await resolve(null, { ...baseArgs, sortBy: 'BY_SCORE' }, { injector }, null);

      expect(result.baseCharges.map(c => c.baseCharge.id)).toEqual([
        'charge-1',
        'charge-0',
        'charge-2',
      ]);
    });
  });
});
