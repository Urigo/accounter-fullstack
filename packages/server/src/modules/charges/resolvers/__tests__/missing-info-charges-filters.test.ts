import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { ScopeProvider } from '../../../auth/providers/scope.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { chargesResolvers } from '../charges.resolver.js';

/**
 * `chargesWithMissingRequiredInfo` filter forwarding.
 *
 * The Missing Info screen offers the same filter set as All Charges, so the
 * resolver narrows the missing-info charge ids through the shared
 * `ChargeFilter` path. Two things must hold: the caller's filters reach the
 * provider alongside the id restriction, and an empty id set returns nothing —
 * the provider reads an empty `IDs` list as "no id filter" and would otherwise
 * return every charge.
 */

type Options = {
  missingInfoChargeIds?: string[];
  readScope?: string[];
};

function contextWithProviders(
  getChargesByFilters: ReturnType<typeof vi.fn>,
  { missingInfoChargeIds = ['charge-1'], readScope = ['owner-1'] }: Options = {},
) {
  const injector = {
    get: (token: unknown) => {
      switch (token) {
        case ChargesProvider:
          return {
            getChargesByFilters,
            getChargesByMissingRequiredInfo: async () =>
              missingInfoChargeIds.map(id => ({ id })),
          };
        case TransactionsProvider:
          return { getTransactionsByMissingRequiredInfo: async () => [] };
        case DocumentsProvider:
          return { getDocumentsByMissingRequiredInfo: async () => [] };
        case ScopeProvider:
          return { getReadScope: async () => readScope };
        default:
          throw new Error('unexpected provider requested');
      }
    },
  } as unknown as Injector;
  return { injector } as never;
}

// The resolver map is typed against the generated module types; the query is
// invoked directly here, which is enough to observe the provider parameters.
const chargesWithMissingRequiredInfo = chargesResolvers.Query!
  .chargesWithMissingRequiredInfo as unknown as (
  parent: unknown,
  args: Record<string, unknown>,
  context: unknown,
) => Promise<{ nodes: unknown[]; pageInfo: { totalPages: number; totalRecords: number } }>;

describe('Query.chargesWithMissingRequiredInfo filter forwarding', () => {
  it('forwards the caller filters alongside the missing-info id restriction', async () => {
    const getChargesByFilters = vi.fn().mockResolvedValue([]);
    await chargesWithMissingRequiredInfo(
      null,
      {
        filters: { byTags: ['tag-1'], freeText: 'Coffee', withoutInvoice: true },
        page: 0,
        limit: 10,
      },
      contextWithProviders(getChargesByFilters, { missingInfoChargeIds: ['charge-1', 'charge-2'] }),
    );

    expect(getChargesByFilters).toHaveBeenCalledTimes(1);
    const params = getChargesByFilters.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.IDs).toEqual(['charge-1', 'charge-2']);
    expect(params).toMatchObject({ tags: ['tag-1'], withoutInvoice: true });
    expect(params.freeText).toBe('coffee');
  });

  // Reads are RLS-scoped anyway, but passing the scope as the owner filter
  // keeps the pagination counts over visible charges only.
  it('applies the read scope as the owner filter', async () => {
    const getChargesByFilters = vi.fn().mockResolvedValue([]);
    await chargesWithMissingRequiredInfo(
      null,
      { filters: undefined, page: 0, limit: 10 },
      contextWithProviders(getChargesByFilters, { readScope: ['owner-1', 'owner-2'] }),
    );

    const params = getChargesByFilters.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.ownerIds).toEqual(['owner-1', 'owner-2']);
  });

  // The screen used to sort newest-first in JS; the shared path defaults to
  // ascending, so an unsorted request must keep asking for DESC explicitly.
  it('keeps the newest-first default when no sort is requested', async () => {
    const getChargesByFilters = vi.fn().mockResolvedValue([]);
    await chargesWithMissingRequiredInfo(
      null,
      { filters: undefined, page: 0, limit: 10 },
      contextWithProviders(getChargesByFilters),
    );

    const params = getChargesByFilters.mock.calls[0]![0] as Record<string, unknown>;
    expect(params).toMatchObject({ sortColumn: 'event_date', asc: false });
  });

  it('returns nothing when no charge has missing info', async () => {
    const getChargesByFilters = vi.fn().mockResolvedValue([]);
    const result = await chargesWithMissingRequiredInfo(
      null,
      { filters: undefined, page: 0, limit: 10 },
      contextWithProviders(getChargesByFilters, { missingInfoChargeIds: [] }),
    );

    expect(getChargesByFilters).not.toHaveBeenCalled();
    expect(result.nodes).toEqual([]);
    expect(result.pageInfo).toMatchObject({ totalPages: 0, totalRecords: 0 });
  });
});
