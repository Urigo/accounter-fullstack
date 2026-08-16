import { useContext, useEffect, useMemo, type ReactElement } from 'react';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { flexRender, useTable, type ColumnDef } from '@tanstack/react-table';
import { tableFeaturesConfig, type TableFeaturesConfig } from '@/lib/table-features.js';
import {
  AllSortCodesForScreenDocument,
  type AllSortCodesForScreenQuery,
} from '../../../gql/graphql.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { DataTablePagination, EditSortCode, InsertSortCode } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Button } from '../../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllSortCodesForScreen {
    allSortCodes {
      id
      ownerId
      key
      name
      defaultIrsCode
    }
  }
`;

type RowType = AllSortCodesForScreenQuery['allSortCodes'][number] & {
  refetchSortCodes: () => void;
};

const columns: ColumnDef<TableFeaturesConfig, RowType>[] = [
  {
    id: 'key',
    accessorKey: 'key',
    cell: ({ row }) => <TableCell>{row.original.key}</TableCell>,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Key
          <ArrowUpDown />
        </Button>
      );
    },
  },
  {
    id: 'name',
    accessorKey: 'name',
    cell: ({ row }) => <TableCell>{row.original.name}</TableCell>,
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
    id: 'defaultIrsCode',
    accessorKey: 'defaultIrsCode',
    cell: ({ row }) => (
      <TableCell className="flex flex-wrap gap-1 p-1">
        {row.original.defaultIrsCode && (
          <Button variant="outline" disabled className="p-1 w-15">
            {row.original.defaultIrsCode}
          </Button>
        )}
      </TableCell>
    ),
    header: 'Default IRS Code',
  },
  {
    id: 'edit',
    cell: ({ row }) => (
      <EditSortCode
        sortCodeKey={row.original.key}
        ownerId={row.original.ownerId}
        onAdd={row.original.refetchSortCodes}
      />
    ),
  },
];

export const SortCodes = (): ReactElement => {
  const [{ data, fetching, error }, refetchSortCodes] = useQuery({
    query: AllSortCodesForScreenDocument,
  });
  const { setFiltersContext } = useContext(FiltersContext);

  const sortCodes = useMemo(
    () =>
      data?.allSortCodes?.map(sortCode => ({
        ...sortCode,
        refetchSortCodes,
      })) ?? [],
    [data?.allSortCodes, refetchSortCodes],
  );

  const table = useTable({
    features: tableFeaturesConfig,
    data: sortCodes,
    columns,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 100,
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
        <DataTablePagination table={table} />
      </div>,
    );
  }, [setFiltersContext, pageIndex, pageSize, pageCount]);

  useEffect(() => {
    if (error) {
      console.error('Error fetching sort codes', error);
      toast.error('Error', {
        description: 'Error fetching sort codes',
      });
    }
  }, [error]);

  return (
    <PageLayout
      title={`Sort Codes (${sortCodes.length})`}
      description="All sort codes"
      headerActions={<InsertSortCode onAdd={() => refetchSortCodes()} />}
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
                    No sort codes found
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
