import { Fragment, useContext, useEffect, useMemo, type ReactElement } from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { flexRender, useTable, type ColumnDef } from '@tanstack/react-table';
import { tableFeaturesConfig, type TableFeaturesConfig } from '@/lib/table-features.js';
import {
  AllTaxCategoriesForScreenDocument,
  type AllTaxCategoriesForScreenQuery,
} from '../../gql/graphql.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { DataTablePagination, InsertTaxCategory } from '../common/index.js';
import { EditTaxCategory } from '../common/modals/edit-tax-category.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { IrsCode } from './cells/irs-code.js';
import { Name } from './cells/name.js';
import { SortCode } from './cells/sort-code.js';
import { TaxExcluded } from './cells/tax-excluded.js';
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

const columns: ColumnDef<TableFeaturesConfig, RowType>[] = [
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

  const table = useTable({
    features: tableFeaturesConfig,
    data: taxCategories,
    columns,
    // Only categories that are some business's default have anything to show.
    getRowCanExpand: row => row.original.businesses.length > 0,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 30,
      },
    },
  });

  // `useTable` hands back a fresh object on every render and `getPageOptions()` a fresh array, so
  // neither can be an effect dependency: the effect would re-run on every render, and setting the
  // filters context re-renders this screen, looping forever ("Maximum update depth exceeded").
  // The pagination bar only reads these primitives, so depend on them instead.
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();

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
          <Loader2 className="h-10 w-10 animate-spin mr-2" />
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
