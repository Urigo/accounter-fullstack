import type { QueryAllBusinessesArgs } from '../../../__generated__/types.js';
import type { BusinessesFiltersParams } from '../providers/businesses.provider.js';

/**
 * The provider filters for an `allBusinesses` call.
 *
 * The top-level `name` / `isClient` arguments predate `filters` and are deprecated; they stay until
 * the MCP server, which still sends them, moves to `filters`. A field *present* in `filters` wins
 * over its argument even when it is an explicit null — GraphQL keeps an omitted input field
 * distinct from a null one, so `??` would wrongly fall back to the argument.
 */
export function resolveBusinessesFilters({
  name,
  isClient,
  filters,
}: Pick<QueryAllBusinessesArgs, 'name' | 'isClient' | 'filters'>): BusinessesFiltersParams {
  return {
    ...filters,
    name: filters && 'name' in filters ? filters.name : name,
    isClient: filters && 'isClient' in filters ? filters.isClient : isClient,
  };
}

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
