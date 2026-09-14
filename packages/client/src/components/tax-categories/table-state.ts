import type { PaginationState, SortingState } from '@tanstack/react-table';

/**
 * Tax categories table state, mirrored into the URL query string so a shared
 * link reproduces the page, page size and sort order the sender was looking at.
 */
export type TaxCategoriesTableState = {
  pagination: PaginationState;
  sorting: SortingState;
};

/** Page sizes the pagination bar offers; anything else would leave its `Select` blank. */
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 30;

export const DEFAULT_TAX_CATEGORIES_TABLE_STATE: TaxCategoriesTableState = {
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  sorting: [],
};

/** Column ids that can be sorted — the table's own sortable columns. */
const SORTABLE_COLUMN_IDS = new Set(['name', 'sortCode', 'irsCode', 'taxExcluded']);

/** URL query-param keys owned by the tax categories table. */
export const TAX_CATEGORIES_TABLE_PARAM_KEYS = ['page', 'pageSize', 'sort'] as const;

/**
 * Read the table state from URL query params. Anything missing, malformed or
 * out of range falls back to the default rather than rendering a broken table:
 * these values arrive from a pasted link and cannot be trusted.
 *
 * `page` is 1-based in the URL (what the pagination bar shows) and 0-based in
 * table state. `sort` is `columnId:asc|desc`, comma-separated for multi-sort.
 */
export function parseTaxCategoriesTableState(params: URLSearchParams): TaxCategoriesTableState {
  const pageParam = Number(params.get('page'));
  const pageIndex =
    Number.isInteger(pageParam) && pageParam >= 1
      ? pageParam - 1
      : DEFAULT_TAX_CATEGORIES_TABLE_STATE.pagination.pageIndex;

  const pageSizeParam = Number(params.get('pageSize'));
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeParam)
    ? pageSizeParam
    : DEFAULT_PAGE_SIZE;

  const sorting = (params.get('sort') ?? '')
    .split(',')
    .flatMap<SortingState[number]>(entry => {
      const [id, direction] = entry.split(':');
      if (!SORTABLE_COLUMN_IDS.has(id) || (direction !== 'asc' && direction !== 'desc')) {
        return [];
      }
      return [{ id, desc: direction === 'desc' }];
    })
    // A repeated column would put the table in a state its headers cannot produce.
    .filter((entry, index, entries) => entries.findIndex(other => other.id === entry.id) === index);

  return { pagination: { pageIndex, pageSize }, sorting };
}

/**
 * Serialize the table state into a flat query-param map. Defaults are omitted
 * so the URL stays clean until the user actually changes something; a key
 * mapped to `undefined` is deleted from the query string by the caller.
 */
export function taxCategoriesTableStateToSearchParams(
  state: TaxCategoriesTableState,
): Partial<Record<(typeof TAX_CATEGORIES_TABLE_PARAM_KEYS)[number], string>> {
  const params: Partial<Record<(typeof TAX_CATEGORIES_TABLE_PARAM_KEYS)[number], string>> = {};

  if (state.pagination.pageIndex > 0) {
    params.page = String(state.pagination.pageIndex + 1);
  }
  if (state.pagination.pageSize !== DEFAULT_PAGE_SIZE) {
    params.pageSize = String(state.pagination.pageSize);
  }
  if (state.sorting.length > 0) {
    params.sort = state.sorting.map(sort => `${sort.id}:${sort.desc ? 'desc' : 'asc'}`).join(',');
  }

  return params;
}
