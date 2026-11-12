import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { BusinessesProvider } from '../../providers/businesses.provider.js';
import { businessesResolvers } from '../businesses.resolver.js';

/**
 * `Query.businesses(ids:)` error shapes.
 *
 * Yoga's default `maskedErrors` replaces any error that is not a `GraphQLError`
 * with "Unexpected error.", so which class the resolver throws decides what the
 * caller sees. An unknown id is the caller's mistake and must say so — the MCP
 * `accounter_create_client` tool matches on that message to turn it into a
 * validation error. A failed load is an outage and must stay masked, so it is
 * not mistaken for a bad id.
 */

const KNOWN = { id: 'aa000000-0000-4000-8000-000000000001', name: 'Some Business' };
const UNKNOWN_ID = 'aa000000-0000-4000-8000-000000000002';

function callBusinesses(ids: string[], loadManyResult: unknown[]): Promise<unknown> {
  const loadMany = vi.fn().mockResolvedValue(loadManyResult);
  const injector = {
    get: (token: unknown) => {
      if (token === BusinessesProvider) {
        return { getBusinessByIdLoader: { loadMany } };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  const resolver = (businessesResolvers.Query as Record<string, unknown>).businesses;
  const resolve = typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  return Promise.resolve(
    (resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown)(
      {},
      { ids },
      { injector },
      {},
    ),
  );
}

describe('Query.businesses', () => {
  it('returns the loaded rows', async () => {
    await expect(callBusinesses([KNOWN.id], [KNOWN])).resolves.toStrictEqual([KNOWN]);
  });

  it('names an unknown id in a GraphQLError, so yoga does not mask it', async () => {
    const result = callBusinesses([KNOWN.id, UNKNOWN_ID], [KNOWN, null]);

    await expect(result).rejects.toBeInstanceOf(GraphQLError);
    await expect(result).rejects.toThrow(`Businesses not found: ID="${UNKNOWN_ID}"`);
  });

  it('keeps a failed load a plain error, so it is masked rather than read as a bad id', async () => {
    const result = callBusinesses([KNOWN.id], [new Error('connection terminated')]);

    await expect(result).rejects.not.toBeInstanceOf(GraphQLError);
    await expect(result).rejects.toThrow('Error fetching some of the businesses');
  });
});
