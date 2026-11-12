/**
 * Sorts the filtered directory by name and slices out one page (0-based). `pageInfo` counts the
 * whole filtered set, not the page; without a `limit` the whole set is one page.
 */
export function paginateBusinesses<T extends { name: string }>(
  businesses: T[],
  page: number | null | undefined,
  limit: number | null | undefined,
) {
  const currentPage = page ?? 0;
  const sorted = businesses.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));

  return {
    __typename: 'PaginatedBusinesses' as const,
    nodes: limit ? sorted.slice(currentPage * limit, (currentPage + 1) * limit) : sorted,
    pageInfo: {
      totalPages: limit ? Math.ceil(sorted.length / limit) : 1,
      totalRecords: sorted.length,
      currentPage,
      pageSize: limit,
    },
  };
}
