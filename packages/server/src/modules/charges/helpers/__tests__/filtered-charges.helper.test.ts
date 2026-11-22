import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum } from '../../../../shared/enums.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { fetchFilteredCharges } from '../filtered-charges.helper.js';

/**
 * Where `fetchFilteredCharges` pages: in the database (one page of rows, the total from
 * `COUNT(*) OVER ()`) unless the concrete-type filter needs every charge in memory first.
 */

const { getChargeTypeMock } = vi.hoisted(() => ({ getChargeTypeMock: vi.fn() }));

vi.mock('../charge-type.js', () => ({
  getChargeType: getChargeTypeMock,
  // The filter's GraphQL values are already the enum values in these tests.
  normalizeDbType: (value: string) => value,
}));

type Window = { limit?: number; offset?: number };

const getChargesByFilters = vi.fn<(params: Window & Record<string, unknown>) => Promise<unknown[]>>();

const injector = {
  get: (token: unknown) => {
    if (token === ChargesProvider) {
      return { getChargesByFilters };
    }
    throw new Error('unexpected provider requested');
  },
} as unknown as Injector;

function rows(ids: string[], total: number) {
  return ids.map(id => ({ id, total_count: String(total) }));
}

beforeEach(() => {
  getChargesByFilters.mockReset();
  getChargeTypeMock.mockReset();
});

describe('fetchFilteredCharges paging', () => {
  it('asks the database for just the page and reads the total off its rows', async () => {
    getChargesByFilters.mockResolvedValue(rows(['c201', 'c202'], 250));

    const result = await fetchFilteredCharges(injector, {
      filters: { byOwners: ['owner-1'] },
      page: 2,
      limit: 100,
    });

    expect(getChargesByFilters).toHaveBeenCalledTimes(1);
    expect(getChargesByFilters.mock.calls[0]![0]).toMatchObject({ limit: 100, offset: 200 });
    expect(result.nodes.map(node => node.id)).toEqual(['c201', 'c202']);
    expect(result.pageInfo).toEqual({ totalPages: 3, totalRecords: 250 });
  });

  it('reports an empty list as no pages', async () => {
    getChargesByFilters.mockResolvedValue([]);

    const result = await fetchFilteredCharges(injector, { filters: {}, page: 0, limit: 100 });

    expect(getChargesByFilters).toHaveBeenCalledTimes(1);
    expect(result.pageInfo).toEqual({ totalPages: 0, totalRecords: 0 });
  });

  it('still reports the total for a page past the end, so the pager can go back', async () => {
    getChargesByFilters.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(['c1'], 250));

    const result = await fetchFilteredCharges(injector, { filters: {}, page: 9, limit: 100 });

    expect(getChargesByFilters).toHaveBeenCalledTimes(2);
    expect(getChargesByFilters.mock.calls[1]![0]).toMatchObject({ limit: 1, offset: 0 });
    expect(result.nodes).toEqual([]);
    expect(result.pageInfo).toEqual({ totalPages: 3, totalRecords: 250 });
  });

  it('fetches every charge and pages in memory when filtering by concrete charge type', async () => {
    getChargesByFilters.mockResolvedValue(rows(['c1', 'c2', 'c3', 'c4', 'c5'], 5));
    getChargeTypeMock.mockImplementation(async (charge: { id: string }) =>
      ['c2', 'c4', 'c5'].includes(charge.id) ? ChargeTypeEnum.Salary : ChargeTypeEnum.Common,
    );

    const result = await fetchFilteredCharges(injector, {
      filters: { byChargeTypes: [ChargeTypeEnum.Salary] } as never,
      page: 1,
      limit: 2,
    });

    const params = getChargesByFilters.mock.calls[0]![0];
    expect(params.limit).toBeUndefined();
    expect(params.offset).toBeUndefined();
    expect(result.nodes.map(node => node.id)).toEqual(['c5']);
    expect(result.pageInfo).toEqual({ totalPages: 2, totalRecords: 3 });
  });

  it.each([
    ['a negative page', { page: -1, limit: 100 }],
    ['a zero limit', { page: 0, limit: 0 }],
    ['a negative limit', { page: 0, limit: -5 }],
  ])('rejects %s as bad input without querying', async (_, window) => {
    await expect(fetchFilteredCharges(injector, { filters: {}, ...window })).rejects.toMatchObject(
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
    expect(getChargesByFilters).not.toHaveBeenCalled();
  });

  it('returns nothing without querying when restricted to no ids', async () => {
    const result = await fetchFilteredCharges(injector, {
      filters: {},
      page: 0,
      limit: 100,
      restrictToIds: [],
    });

    expect(getChargesByFilters).not.toHaveBeenCalled();
    expect(result.pageInfo).toEqual({ totalPages: 0, totalRecords: 0 });
  });
});
