import type { Column, RowData, Table } from '@tanstack/react-table';
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
 * Features every table in the client shares, regardless of whether it paginates.
 *
 * The row-model creators are deliberately *not* in here: each feature set below calls them itself,
 * so the two sets never hand the same factory instance to two different tables.
 */
const baseFeatures = {
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filterFns,
  sortFns,
};

/**
 * Default TanStack Table v9 feature set — **no pagination**, so `getRowModel()` returns every row.
 *
 * Pagination is absent on purpose. v9 resolves `getRowModel()` through `getPaginatedRowModel()`,
 * which slices to the current page as soon as a `paginatedRowModel` factory is registered — and
 * TanStack's default page size is 10. While this set registered one, every table that forgot to set
 * `initialState.pagination` was silently capped at ten rows, and the ones rendering no pagination
 * control gave the user no way to reach the rest. Rendering every row is the safe failure mode: a
 * slow table gets noticed, missing rows get signed off on.
 *
 * With no factory registered, `getPaginatedRowModel()` falls back to the pre-paginated row model,
 * so tables on this set are unpaginated rather than paginated-with-one-huge-page.
 *
 * v9 no longer bundles features automatically: each feature (and its row model) must be registered
 * explicitly. Use this set unless the table paginates; see {@link paginatedTableFeaturesConfig}.
 */
export const tableFeaturesConfig = tableFeatures({
  ...baseFeatures,
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
});

/** Feature set backing every non-paginated table — the `TFeatures` generic argument. */
export type TableFeaturesConfig = typeof tableFeaturesConfig;

/**
 * `tableFeaturesConfig` plus pagination, for the tables that genuinely page through their rows.
 *
 * Opt in by passing this as `features` **and** rendering a pagination control
 * (`common/data-table-pagination.tsx` or `common/pagination.tsx`) — never one without the other. A
 * page size with no control to change it is exactly how the ten-row truncation stayed invisible.
 *
 * This set being a superset of `tableFeaturesConfig` does *not* make their types interchangeable:
 * `ColumnDef`, `Column`, `Row` and `Table` are all invariant in the feature set (`ColumnDef` is
 * mutually recursive with `HeaderContext`, which carries a `Column`, which carries a `ColumnDef`).
 * A paginated table needs its own column definitions annotated with `PaginatedTableFeaturesConfig`,
 * and a component serving both kinds of table takes {@link AnyColumn} / {@link AnyTable}.
 */
export const paginatedTableFeaturesConfig = tableFeatures({
  ...baseFeatures,
  rowPaginationFeature,
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

/** Feature set backing every paginated table — the `TFeatures` generic argument. */
export type PaginatedTableFeaturesConfig = typeof paginatedTableFeaturesConfig;

/**
 * A column from *either* feature set, for components shared by paginated and non-paginated tables.
 *
 * It has to be a union of the two concrete types rather than a `TFeatures` type parameter: v9
 * assembles `Column` with conditional types keyed on the feature set, and TypeScript defers those
 * conditionals while `TFeatures` is an unresolved parameter — collapsing `Column` to a union that
 * has lost `getCanSort`, `toggleSorting` and friends. Each concrete member resolves on its own, so
 * the shared APIs stay callable.
 */
export type AnyColumn<TData extends RowData, TValue = unknown> =
  Column<TableFeaturesConfig, TData, TValue> | Column<PaginatedTableFeaturesConfig, TData, TValue>;

/** A table from *either* feature set. Same reasoning as {@link AnyColumn}. */
export type AnyTable<TData extends RowData> =
  Table<TableFeaturesConfig, TData> | Table<PaginatedTableFeaturesConfig, TData>;
