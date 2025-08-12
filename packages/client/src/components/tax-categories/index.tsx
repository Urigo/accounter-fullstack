import { useContext, useEffect, type ReactElement } from 'react';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
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
import { Name } from './cells/name.js';
import { SortCode } from './cells/sort-code.js';

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
    }
  }
`;

type RowType = AllTaxCategoriesForScreenQuery['taxCategories'][number];

const columns: ColumnDef<RowType>[] = [
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
    id: 'edit',
    cell: ({ row }) => <EditTaxCategory taxCategoryId={row.original.id} />,
  },
];

export const TaxCategories = (): ReactElement => {
  const [{ data, fetching, error }, refetchTaxCategories] = useQuery({
    query: AllTaxCategoriesForScreenDocument,
  });
  const { setFiltersContext } = useContext(FiltersContext);

  const taxCategories = data?.taxCategories ?? [];

  const table = useReactTable({
    data: taxCategories,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 30,
      },
    },
  });

  const pagination = table.getPageOptions();

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end gap-10 space-x-2 py-4">
        <div className="flex items-center justify-between px-2">
          <DataTablePagination table={table} />
        </div>
      </div>,
    );
  }, [setFiltersContext, table, pagination]);

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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </PageLayout>
  );
};
