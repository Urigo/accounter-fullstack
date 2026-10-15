import { describe, expect, it } from 'vitest';
import type { BusinessesFiltersParams } from '../../providers/businesses.provider.js';
import { paginateBusinesses, resolveBusinessesFilters } from '../all-businesses.helper.js';

describe('resolveBusinessesFilters', () => {
  it('passes the filters input through', () => {
    const filters: BusinessesFiltersParams = {
      taxCategoryIds: ['tc-1'],
      withoutTaxCategory: true,
      sortCodes: [100],
      countries: ['ISR'],
      isActive: true,
      isAdmin: false,
    };

    expect(resolveBusinessesFilters({ filters })).toMatchObject(filters);
  });

  it('still honours the deprecated top-level name / isClient arguments', () => {
    expect(resolveBusinessesFilters({ name: 'acme', isClient: true })).toMatchObject({
      name: 'acme',
      isClient: true,
    });
  });

  it('lets a filters field win over its same-named argument', () => {
    expect(
      resolveBusinessesFilters({
        name: 'from-arg',
        isClient: true,
        filters: { name: 'from-filter', isClient: false },
      }),
    ).toMatchObject({ name: 'from-filter', isClient: false });
  });

  it('lets an explicit null in filters clear its same-named argument', () => {
    expect(
      resolveBusinessesFilters({
        name: 'acme',
        isClient: true,
        filters: { name: null, isClient: null },
      }),
    ).toMatchObject({ name: null, isClient: null });
  });

  it('falls back to the argument when filters omits the field', () => {
    expect(
      resolveBusinessesFilters({ name: 'acme', isClient: true, filters: { isActive: true } }),
    ).toMatchObject({ name: 'acme', isClient: true, isActive: true });
  });
});

describe('paginateBusinesses', () => {
  const rows = () => [
    { id: '3', name: 'charlie' },
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'bravo' },
  ];

  it('sorts by name and pages the set, counting it whole', () => {
    const result = paginateBusinesses(rows(), 1, 2);

    expect(result.nodes.map(row => row.name)).toEqual(['charlie']);
    expect(result.pageInfo).toEqual({
      totalPages: 2,
      totalRecords: 3,
      currentPage: 1,
      pageSize: 2,
    });
  });

  it('returns the whole sorted set as one page without a limit', () => {
    const result = paginateBusinesses(rows(), null, null);

    expect(result.nodes.map(row => row.name)).toEqual(['Alpha', 'bravo', 'charlie']);
    expect(result.pageInfo).toMatchObject({ totalPages: 1, totalRecords: 3, currentPage: 0 });
  });
});
