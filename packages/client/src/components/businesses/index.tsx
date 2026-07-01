import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import { AllBusinessesForScreenDocument } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { cn } from '../../lib/utils.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { InsertBusiness, MergeBusinessesButton } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { businessNodesToRows } from './business-rows.js';
import { BusinessesFilters } from './businesses-filters.js';
import { columns } from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllBusinessesForScreen($page: Int, $limit: Int, $name: String) {
    allBusinesses(page: $page, limit: $limit, name: $name) {
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
      pageInfo {
        totalPages
        totalRecords
      }
    }
  }
`;

export const Businesses = (): ReactElement => {
  const { get } = useUrlQuery();
  const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 0);
  const [businessName, setBusinessName] = useState(
    get('name') ? (get('name') as string) : undefined,
  );
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }, refetch] = useQuery({
    query: AllBusinessesForScreenDocument,
    variables: {
      page: activePage,
      limit: 100,
      name: businessName,
    },
  });

  const rows = useMemo(
    () => businessNodesToRows(data?.allBusinesses?.nodes ?? []),
    [data?.allBusinesses?.nodes],
  );

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

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
    const selectedForMerge = table
      .getSelectedRowModel()
      .rows.map(row => ({ id: row.original.id, onChange: onMergeChange }));
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <BusinessesFilters
          activePage={activePage}
          setPage={setActivePage}
          businessName={businessName}
          setBusinessName={setBusinessName}
          totalPages={data?.allBusinesses?.pageInfo.totalPages}
        />
        <MergeBusinessesButton selected={selectedForMerge} resetMerge={() => setRowSelection({})} />
      </div>,
    );
  }, [
    data,
    activePage,
    businessName,
    setFiltersContext,
    setActivePage,
    setBusinessName,
    rowSelection,
    refetch,
    table,
  ]);

  return (
    <PageLayout
      title={`Businesses (${data?.allBusinesses?.pageInfo.totalRecords ?? ''})`}
      description="All businesses"
      headerActions={
        <div className="flex items-center py-4 gap-4">
          <InsertBusiness description="" onAdd={() => refetch()} />
        </div>
      }
    >
      {fetching ? (
        <div className="flex flex-row justify-center">
          <Loader2 className={cn('h-10 w-10 animate-spin mr-2')} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
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
        </div>
      )}
    </PageLayout>
  );
};
