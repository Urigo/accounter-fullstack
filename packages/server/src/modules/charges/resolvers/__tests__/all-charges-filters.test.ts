import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { chargesResolvers } from '../charges.resolver.js';

/**
 * `allCharges` filter forwarding.
 *
 * The resolver hand-maps every `ChargeFilter` field onto the provider's
 * parameters, so a field can be accepted by the schema and then silently
 * dropped here — the query still succeeds, it just returns unfiltered rows.
 * `fromDate`/`toDate` were dropped exactly this way: the SQL has always had the
 * predicate, and the MCP charge tools expose the field, but nothing passed it on.
 */

function contextWithProvider(getChargesByFilters: ReturnType<typeof vi.fn>) {
  const injector = {
    get: (token: unknown) => {
      if (token === ChargesProvider) {
        return { getChargesByFilters };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { injector } as never;
}

// The resolver map is typed against the generated module types; the query is
// invoked directly here, which is enough to observe the provider parameters.
const allCharges = chargesResolvers.Query!.allCharges as unknown as (
  parent: unknown,
  args: Record<string, unknown>,
  context: unknown,
) => Promise<{ nodes: unknown[] }>;

async function paramsFor(filters: Record<string, unknown>) {
  const getChargesByFilters = vi.fn().mockResolvedValue([]);
  await allCharges(
    null,
    { filters, page: 0, limit: 10 },
    contextWithProvider(getChargesByFilters),
  );
  expect(getChargesByFilters).toHaveBeenCalledTimes(1);
  return getChargesByFilters.mock.calls[0]![0] as Record<string, unknown>;
}

describe('Query.allCharges filter forwarding', () => {
  it('forwards the containment date pair (fromDate/toDate)', async () => {
    const params = await paramsFor({ fromDate: '2026-01-01', toDate: '2026-01-31' });
    expect(params.fromDate).toBe('2026-01-01');
    expect(params.toDate).toBe('2026-01-31');
  });

  it('forwards the overlap date pair (fromAnyDate/toAnyDate)', async () => {
    const params = await paramsFor({ fromAnyDate: '2026-01-01', toAnyDate: '2026-01-31' });
    expect(params.fromAnyDate).toBe('2026-01-01');
    expect(params.toAnyDate).toBe('2026-01-31');
  });

  // The two pairs ask different questions — containment vs overlap — so passing
  // one must never populate the other.
  it('keeps the two date pairs independent', async () => {
    const params = await paramsFor({ fromDate: '2026-01-01' });
    expect(params.fromDate).toBe('2026-01-01');
    expect(params.fromAnyDate).toBeUndefined();
    expect(params.toAnyDate).toBeUndefined();
  });

  it('forwards owner, tag, counterparty and missing-document predicates', async () => {
    const params = await paramsFor({
      byOwners: ['owner-1'],
      byTags: ['tag-1'],
      byBusinesses: ['biz-1'],
      byBusinessTrips: ['trip-1'],
      byFinancialAccounts: ['account-1'],
      chargesType: 'EXPENSE',
      freeText: 'Coffee',
      withoutInvoice: true,
      withoutReceipt: false,
      accountantStatus: ['PENDING'],
    });
    expect(params).toMatchObject({
      ownerIds: ['owner-1'],
      tags: ['tag-1'],
      businessIds: ['biz-1'],
      businessTripIds: ['trip-1'],
      accountIds: ['account-1'],
      chargeType: 'EXPENSE',
      withoutInvoice: true,
      withoutReceipt: false,
      accountantStatuses: ['PENDING'],
    });
    // Free text is normalized for the trigram search.
    expect(params.freeText).toBe('coffee');
  });
});
