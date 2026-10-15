import { describe, expect, it } from 'vitest';
import { paginateBusinesses } from '../all-businesses.helper.js';

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
