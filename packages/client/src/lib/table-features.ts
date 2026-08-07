import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * Shared TanStack Table v9 feature set for every table in the client.
 *
 * v9 no longer bundles features automatically: each feature (and its row model)
 * must be registered explicitly. A single shared set keeps the generic
 * `TFeatures` parameter identical across all tables and shared table
 * components (pagination, column headers, batch action menus, ...).
 */
export const tableFeaturesConfig = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns,
  sortFns,
});

/** Feature set backing every table in the client — the `TFeatures` generic argument. */
export type TableFeaturesConfig = typeof tableFeaturesConfig;
