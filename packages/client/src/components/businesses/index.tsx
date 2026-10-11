import { Fragment, useContext, useEffect, useMemo, type ReactElement } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useQuery } from 'urql';
import {
  flexRender,
  useTable,
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { useEphemeralState } from '@/hooks/use-ephemeral-state.js';
import { usePersistentState } from '@/hooks/use-persistent-state.js';
import { paginatedTableFeaturesConfig } from '@/lib/table-features.js';
import { AllBusinessesForScreenDocument, BusinessesUsageDocument } from '../../gql/graphql.js';
import { FiltersContext } from '../../providers/filters-context.js';
import {
  DataTablePagination,
  InsertBusiness,
  MergeBusinessesButton,
  TableSkeleton,
} from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from '../ui/empty.js';
import { LoadingOverlay } from '../ui/overlay.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { BatchUpdateBusinessesDialog } from './batch-update-dialog.js';
import {
  businessNodesToRows,
  isBusinessUnused,
  mergeBusinessUsage,
  type BusinessTableMeta,
} from './business-rows.js';
import {
  BusinessesFilters,
  hasActiveFilters,
  toServerFilter,
  useBusinessesFilter,
} from './businesses-filters/index.js';
import { COLUMN_GROUPS, columns, DEFAULT_COLUMN_VISIBILITY, USAGE_COLUMN_IDS } from './columns.js';
import { TableScrollContainer } from './table-scroll-container.js';
import {
  BUSINESSES_ROW_SELECTION_KEY,
  BUSINESSES_STORAGE_KEYS,
  reviveColumnVisibility,
  reviveSorting,
} from './table-state-storage.js';

const EMPTY_ROW_SELECTION: RowSelectionState = {};
const EMPTY_SORTING: SortingState = [];

// Filtering is server-side (see the filters toolbar), but the matching set is fetched whole, with
// no server pagination, so sorting and pagination stay client-side and apply across all of it.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllBusinessesForScreen($filters: BusinessFilter) {
    allBusinesses(filters: $filters) {
      nodes {
        __typename
        id
        name
        ... on LtdFinancialEntity {
          hebrewName
          governmentId
          country {
            id
            code
          }
          city
          zipCode
          createdAt
          updatedAt
          sortCode {
            id
            key
            name
          }
          taxCategory {
            id
            name
          }
          irsCode
          pcn874RecordType
          isClient
          isAdmin
          isActive
          suggestions {
            description
            tags {
              id
              name
            }
          }
        }
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessesUsage($ids: [UUID!]!) {
    businessesUsage(ids: $ids) {
      id
      businessId
      totalTransactions
      totalDocuments
      totalMiscExpenses
      totalLedgerRecords
    }
  }
`;

export const Businesses = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);

  // Persisted in the URL. `unusedOnly` is applied below, in the browser; the rest goes upstream.
  const [filter, setFilter] = useBusinessesFilter();
  const serverFilter = useMemo(() => toServerFilter(filter), [filter]);
  const filtered = hasActiveFilters(filter);

  // urql keeps the previous `data` while a new filter loads, so the table stays on screen under
  // a loading overlay instead of collapsing to a skeleton on every apply.
  const [{ data, fetching, error }, refetch] = useQuery({
    query: AllBusinessesForScreenDocument,
    variables: { filters: serverFilter },
  });

  const rows = useMemo(
    () => businessNodesToRows(data?.allBusinesses?.nodes ?? []),
    [data?.allBusinesses?.nodes],
  );

  // Selection is transient: it follows the user across navigation and filter changes, but a page
  // refresh starts from a clean slate — hence an in-memory store rather than localStorage.
  const [rowSelection, setRowSelection] = useEphemeralState<RowSelectionState>(
    BUSINESSES_ROW_SELECTION_KEY,
    EMPTY_ROW_SELECTION,
  );
  // Column visibility and sorting are preferences: they stick across refreshes.
  const [columnVisibility, setColumnVisibility] = usePersistentState<ColumnVisibilityState>(
    BUSINESSES_STORAGE_KEYS.COLUMN_VISIBILITY,
    DEFAULT_COLUMN_VISIBILITY,
    reviveColumnVisibility,
  );
  const [sorting, setSorting] = usePersistentState<SortingState>(
    BUSINESSES_STORAGE_KEYS.SORTING,
    EMPTY_SORTING,
    reviveSorting,
  );
  // Usage counts are lazy: fetched once a usage column is enabled or "unused only" is on.
  const businessIds = useMemo(() => rows.map(row => row.id), [rows]);
  const usageEnabled = USAGE_COLUMN_IDS.some(id => columnVisibility[id]) || !!filter.unusedOnly;
  const [{ data: usageData, fetching: usageFetching }] = useQuery({
    query: BusinessesUsageDocument,
    variables: { ids: businessIds },
    pause: !usageEnabled || businessIds.length === 0,
  });

  const tableRows = useMemo(
    () => mergeBusinessUsage(rows, usageData?.businessesUsage ?? []),
    [rows, usageData],
  );
  // Rows whose counts haven't loaded yet are excluded: they are not known to be unused.
  const filteredRows = useMemo(
    () => (filter.unusedOnly ? tableRows.filter(isBusinessUnused) : tableRows),
    [tableRows, filter.unusedOnly],
  );

  const table = useTable({
    features: paginatedTableFeaturesConfig,
    data: filteredRows,
    columns,
    getRowId: row => row.id,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 100 },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: {
      rowSelection,
      columnVisibility,
      sorting,
    },
    // cast: @tanstack's TableMeta interface is empty by default (not augmented here); cells read
    // these handles back off table.options.meta with a matching cast.
    meta: {
      usageFetching: usageEnabled && usageFetching,
      refetchBusinesses: () => refetch(),
    } as BusinessTableMeta,
  });

  // Read straight off `rowSelection` (keyed by row id via getRowId), avoiding the unstable `table`
  // object. Deliberately not intersected with the loaded rows: filtering is server-side, so a row
  // selected under one filter is absent from the next result, yet stays selected — merge and
  // batch-update still act on it, and it is checked again once a filter shows it. Deleting a
  // business deselects it (see business-row-actions).
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter(id => rowSelection[id]),
    [rowSelection],
  );

  // Footer
  useEffect(() => {
    // MergeBusinessesButton calls onChange once per selected row, so guard to refetch only once
    let refetched = false;
    const onMergeChange = (): void => {
      if (!refetched) {
        refetched = true;
        refetch();
      }
    };
    const selectedForMerge = selectedIds.map(id => ({
      id,
      onChange: onMergeChange,
    }));
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BusinessesFilters
          filter={filter}
          setFilter={setFilter}
          usageLoading={usageEnabled && usageFetching}
        />
        <MergeBusinessesButton selected={selectedForMerge} resetMerge={() => setRowSelection({})} />
        <BatchUpdateBusinessesDialog
          businessIds={selectedIds}
          onDone={() => {
            refetch();
            setRowSelection({});
          }}
        />
      </div>,
    );
  }, [
    setFiltersContext,
    selectedIds,
    refetch,
    filter,
    setFilter,
    setRowSelection,
    usageEnabled,
    usageFetching,
  ]);

  return (
    <PageLayout
      title={`Businesses (${filteredRows.length})`}
      description={filtered ? 'Businesses matching the filters' : 'All businesses'}
      headerActions={
        <div className="flex items-center py-4 gap-4">
          <InsertBusiness description="" onAdd={() => refetch()} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Columns <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {COLUMN_GROUPS.map(group => ({
                ...group,
                columns: group.columns.filter(column => table.getColumn(column.id)?.getCanHide()),
              }))
                .filter(group => group.columns.length > 0)
                .map((group, groupIndex) => {
                  const allVisible = group.columns.every(
                    column => table.getColumn(column.id)?.getIsVisible() ?? false,
                  );
                  return (
                    <Fragment key={group.label}>
                      {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        className="flex w-full items-center justify-between gap-4 font-semibold"
                        onSelect={event => {
                          event.preventDefault();
                          for (const column of group.columns) {
                            table.getColumn(column.id)?.toggleVisibility(!allVisible);
                          }
                        }}
                      >
                        {group.label}
                        <span className="text-xs font-normal text-muted-foreground">
                          {allVisible ? 'Hide all' : 'Show all'}
                        </span>
                      </DropdownMenuItem>
                      {group.columns.map(column => {
                        const tableColumn = table.getColumn(column.id);
                        return tableColumn ? (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={tableColumn.getIsVisible()}
                            onCheckedChange={value => tableColumn.toggleVisibility(!!value)}
                          >
                            {column.label}
                          </DropdownMenuCheckboxItem>
                        ) : null;
                      })}
                    </Fragment>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load businesses</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : fetching && !data ? (
        <div className="rounded-md border p-4">
          <TableSkeleton columns={8} rows={10} />
        </div>
      ) : rows.length === 0 && !filtered ? (
        <Empty className="py-8 sm:py-12">
          <EmptyMedia>
            <Building2 className="size-8 sm:size-10 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>No businesses yet</EmptyTitle>
          <EmptyDescription>
            Add your first business, or generate businesses from your transactions.
          </EmptyDescription>
          <EmptyContent>
            <InsertBusiness description="" onAdd={() => refetch()} />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="relative space-y-4">
          <LoadingOverlay visible={fetching} className="z-10 rounded-md" />
          <TableScrollContainer className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map(row => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
          <DataTablePagination table={table} />
        </div>
      )}
    </PageLayout>
  );
};
