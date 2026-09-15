import { Fragment, useCallback, useContext, useEffect, useMemo, type ReactElement } from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  flexRender,
  useTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import {
  paginatedTableFeaturesConfig,
  type PaginatedTableFeaturesConfig,
} from '@/lib/table-features.js';
import {
  AllTaxCategoriesForScreenDocument,
  type AllTaxCategoriesForScreenQuery,
} from '../../gql/graphql.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { DataTablePagination, InsertTaxCategory } from '../common/index.js';
import { EditTaxCategory } from '../common/modals/edit-tax-category.js';
import { PageLayout } from '../layout/page-layout.js';
import { AccounterBarSpinner } from '../ui/accounter-spinner.js';
import { Button } from '../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { IrsCode } from './cells/irs-code.js';
import { Name } from './cells/name.js';
import { SortCode } from './cells/sort-code.js';
import { TaxExcluded } from './cells/tax-excluded.js';
import {
  parseTaxCategoriesTableState,
  TAX_CATEGORIES_TABLE_PARAM_KEYS,
  taxCategoriesTableStateToSearchParams,
  type TaxCategoriesTableState,
} from './table-state.js';
import { TaxCategoryBusinesses } from './tax-category-businesses.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllTaxCategoriesForScreen {
    taxCategories {
      id
      name
      sortCode {
        id
        key
        name
      }
      irsCode
      taxExcluded
      businesses {
        id
        name
      }
    }
  }
`;

type RowType = AllTaxCategoriesForScreenQuery['taxCategories'][number];

const columns: ColumnDef<PaginatedTableFeaturesConfig, RowType>[] = [
  {
    id: 'expander',
    header: () => null,
    cell: ({ row }) =>
      row.getCanExpand() ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => row.toggleExpanded()}
          aria-label={
            row.getIsExpanded()
              ? `Hide businesses of ${row.original.name}`
              : `Show businesses of ${row.original.name}`
          }
        >
          {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
        </Button>
      ) : null,
    enableSorting: false,
  },
  {
    id: 'name',
    accessorKey: 'name',
    cell: ({ row }) => <Name data={row.original} />,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown />
        </Button>
      );
    },
  },
  {
    id: 'sortCode',
    accessorKey: 'sortCode.key',
    cell: ({ row }) => <SortCode data={row.original} />,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Sort Code
          <ArrowUpDown />
        </Button>
      );
    },
  },
  {
    id: 'irsCode',
    accessorKey: 'irsCode',
    cell: ({ row }) => <IrsCode data={row.original} />,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          IRS Code
          <ArrowUpDown />
        </Button>
      );
    },
  },
  {
    id: 'taxExcluded',
    accessorKey: 'taxExcluded',
    cell: ({ row }) => <TaxExcluded data={row.original} />,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Tax Excluded
          <ArrowUpDown />
        </Button>
      );
    },
  },
  {
    id: 'edit',
    cell: ({ row }) => <EditTaxCategory taxCategoryId={row.original.id} />,
  },
];

export const TaxCategories = (): ReactElement => {
  const [{ data, fetching, error }, refetchTaxCategories] = useQuery({
    query: AllTaxCategoriesForScreenDocument,
  });
  const { setFiltersContext } = useContext(FiltersContext);

  const taxCategories = useMemo(() => data?.taxCategories ?? [], [data?.taxCategories]);

  // Page, page size and sort order live in the URL query string, so a shared
  // link reproduces exactly what the sender was looking at.
  const [searchParams, setSearchParams] = useSearchParams();
  const { pagination, sorting } = useMemo(
    () => parseTaxCategoriesTableState(searchParams),
    [searchParams],
  );

  const writeTableState = useCallback(
    (next: TaxCategoriesTableState): void => {
      setSearchParams(
        prev => {
          // Merge into the existing params so unrelated ones are preserved;
          // only the keys this table owns are set or cleared.
          const merged = new URLSearchParams(prev);
          const nextParams = taxCategoriesTableStateToSearchParams(next);
          for (const key of TAX_CATEGORIES_TABLE_PARAM_KEYS) {
            const value = nextParams[key];
            if (value == null) {
              merged.delete(key);
            } else {
              merged.set(key, value);
            }
          }
          return merged;
        },
        // replace: paging and sorting shouldn't stack history entries, so Back
        // still leaves the screen rather than replaying every click.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handlePaginationChange = useCallback<OnChangeFn<PaginationState>>(
    updater => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      writeTableState({ pagination: next, sorting });
    },
    [pagination, sorting, writeTableState],
  );

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    updater => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      // Re-sorting reorders the whole set, so the rows under the current page
      // number are unrelated to the ones the user was just looking at.
      writeTableState({ pagination: { ...pagination, pageIndex: 0 }, sorting: next });
    },
    [pagination, sorting, writeTableState],
  );

  const table = useTable({
    features: paginatedTableFeaturesConfig,
    data: taxCategories,
    columns,
    // Only categories that are some business's default have anything to show.
    getRowCanExpand: row => row.original.businesses.length > 0,
    state: { pagination, sorting },
    onPaginationChange: handlePaginationChange,
    onSortingChange: handleSortingChange,
    // The page index lives in the URL, so the table must not reset it on its
    // own. Its default is to jump back to page 1 whenever a row model
    // recomputes — which a fresh `data` identity from urql does on its own —
    // and that would silently rewrite the page out of a shared link. The one
    // reset worth having is explicit, in `handleSortingChange`.
    autoResetPageIndex: false,
  });

  // `useTable` hands back a fresh object on every render and `getPageOptions()` a fresh array, so
  // neither can be an effect dependency: the effect would re-run on every render, and setting the
  // filters context re-renders this screen, looping forever ("Maximum update depth exceeded").
  // The pagination bar only reads these primitives, so depend on them instead.
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();

  // A link can outlive the rows it pointed at (a category deleted, a smaller
  // page size). Land on the last real page instead of rendering an empty table.
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      writeTableState({ pagination: { pageIndex: pageCount - 1, pageSize }, sorting });
    }
  }, [pageCount, pageIndex, pageSize, sorting, writeTableState]);

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end gap-10 space-x-2 py-4">
        <div className="flex items-center justify-between px-2">
          <DataTablePagination table={table} />
        </div>
      </div>,
    );
  }, [setFiltersContext, pageIndex, pageSize, pageCount]);

  useEffect(() => {
    if (error) {
      toast.error('Error', {
        description: 'Error fetching tax categories',
      });
    }
  }, [error]);

  return (
    <PageLayout
      title={`Tax Categories (${taxCategories.length})`}
      description="All tax categories"
      headerActions={<InsertTaxCategory onAdd={() => refetchTaxCategories()} />}
    >
      {fetching ? (
        <div className="flex flex-row justify-center">
          <AccounterBarSpinner />
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8">
                    No tax categories found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map(row => (
                  <Fragment key={row.id}>
                    <TableRow>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && (
                      <TableRow>
                        <TableCell colSpan={columns.length}>
                          <TaxCategoryBusinesses businesses={row.original.businesses} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </PageLayout>
  );
};
