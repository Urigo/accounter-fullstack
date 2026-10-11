import { describe, expect, it, vi } from 'vitest';
import type { BusinessesFiltersParams } from '../../providers/businesses.provider.js';
import { BusinessesProvider } from '../../providers/businesses.provider.js';
import { businessesResolvers } from '../businesses.resolver.js';

type Row = { id: string; name: string };

type AllBusinessesArgs = {
  page?: number | null;
  limit?: number | null;
  name?: string | null;
  isClient?: boolean | null;
  filters?: BusinessesFiltersParams | null;
};

type AllBusinessesResult = {
  nodes: Row[];
  pageInfo: { totalPages: number; totalRecords: number; currentPage: number };
};

/**
 * The generated `Resolver` type is a union of a plain function and a `{ resolve }` object, so
 * unwrap whichever form it is rather than casting the union away.
 */
async function callAllBusinesses(args: AllBusinessesArgs, rows: Row[]) {
  const getBusinessesByFilters = vi.fn().mockResolvedValue(rows);
  const injector = {
    get: (token: unknown) => {
      if (token === BusinessesProvider) return { getBusinessesByFilters };
      throw new Error('unexpected provider');
    },
  };
  const resolver = businessesResolvers.Query?.allBusinesses as unknown;
  const resolve = typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  const result = (await (
    resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown
  )({}, args, { injector }, {})) as AllBusinessesResult;
  return { result, getBusinessesByFilters };
}

describe('Query.allBusinesses', () => {
  it('forwards the filters input to the provider', async () => {
    const filters: BusinessesFiltersParams = {
      taxCategoryIds: ['tc-1'],
      withoutTaxCategory: true,
      sortCodes: [100],
      countries: ['ISR'],
      isActive: true,
      isAdmin: false,
    };

    const { getBusinessesByFilters } = await callAllBusinesses({ filters }, []);

    expect(getBusinessesByFilters).toHaveBeenCalledWith(expect.objectContaining(filters));
  });

  it('still honours the legacy top-level name / isClient arguments', async () => {
    const { getBusinessesByFilters } = await callAllBusinesses({ name: 'acme', isClient: true }, []);

    expect(getBusinessesByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'acme', isClient: true }),
    );
  });

  it('lets a filters field win over its same-named argument', async () => {
    const { getBusinessesByFilters } = await callAllBusinesses(
      { name: 'from-arg', isClient: true, filters: { name: 'from-filter', isClient: false } },
      [],
    );

    expect(getBusinessesByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'from-filter', isClient: false }),
    );
  });

  it('lets an explicit null in filters clear its same-named argument', async () => {
    const { getBusinessesByFilters } = await callAllBusinesses(
      { name: 'acme', isClient: true, filters: { name: null, isClient: null } },
      [],
    );

    expect(getBusinessesByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ name: null, isClient: null }),
    );
  });

  it('falls back to the argument when filters omits the field', async () => {
    const { getBusinessesByFilters } = await callAllBusinesses(
      { name: 'acme', isClient: true, filters: { isActive: true } },
      [],
    );

    expect(getBusinessesByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'acme', isClient: true, isActive: true }),
    );
  });

  it('sorts by name and pages the filtered set, counting it whole', async () => {
    const rows = [
      { id: '3', name: 'charlie' },
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'bravo' },
    ];

    const { result } = await callAllBusinesses({ page: 1, limit: 2 }, rows);

    expect(result.nodes.map(row => row.name)).toEqual(['charlie']);
    expect(result.pageInfo).toMatchObject({ totalPages: 2, totalRecords: 3, currentPage: 1 });
  });
});
