import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useQuery } from 'urql';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  BusinessLedgerInfoDocument,
  Currency,
  type BusinessLedgerInfoQuery,
  type BusinessTransactionsFilter,
} from '../../gql/graphql.js';
import { Pagination } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { Input } from '../ui/input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { Skeleton } from '../ui/skeleton.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { getAllColumns, getInitialColumnVisibility } from './business-extended-info-columns.js';
import { BusinessExtendedInfoRow } from './business-extended-info-row.js';
import { DownloadCSV } from './download-csv.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessLedgerInfo($filters: BusinessTransactionsFilter) {
    businessTransactionsFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsFromLedgerRecordsSuccessfulResult {
        businessTransactions {
          amount {
            formatted
            raw
          }
          business {
            id
            name
          }
          foreignAmount {
            formatted
            raw
            currency
          }
          invoiceDate
          reference
          details
          counterAccount {
            __typename
            id
            name
          }
          chargeId
        }
      }
      ... on CommonError {
        __typename
        message
      }
    }
  }
`;

export type ExtendedLedger = Extract<
  BusinessLedgerInfoQuery['businessTransactionsFromLedgerRecords'],
  { __typename?: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult' }
>['businessTransactions'][number] & {
  ilsBalance: number;
  [currencyBalance: string]: number;
};

interface Props {
  businessID: string;
  filter?: Pick<BusinessTransactionsFilter, 'fromDate' | 'ownerIds' | 'toDate'>;
}

const STORAGE_KEY_PREFIX = 'businessLedger';
const STORAGE_KEYS = {
  SORTING: `${STORAGE_KEY_PREFIX}_sorting`,
  COLUMN_VISIBILITY: `${STORAGE_KEY_PREFIX}_columnVisibility`,
} as const;

export function BusinessExtendedInfo({ businessID, filter }: Props): ReactElement {
  // Load initial state from localStorage
  const [sorting, setSorting] = useState<SortingState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SORTING);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  // Persist sorting to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SORTING, JSON.stringify(sorting));
    } catch (error) {
      console.warn('Failed to save sorting to localStorage:', error);
    }
  }, [sorting]);

  const { fromDate, ownerIds, toDate } = filter ?? {};
  const [{ data, fetching }] = useQuery({
    query: BusinessLedgerInfoDocument,
    variables: {
      filters: {
        fromDate,
        ownerIds,
        toDate,
        businessIDs: [businessID],
      },
    },
  });

  const ledgerRecords = useMemo(
    () =>
      data?.businessTransactionsFromLedgerRecords.__typename === 'CommonError'
        ? []
        : (data?.businessTransactionsFromLedgerRecords.businessTransactions.sort((a, b) =>
            a.invoiceDate > b.invoiceDate ? 1 : -1,
          ) ?? []),
    [data],
  );

  const extendedLedgerRecords: Array<ExtendedLedger> = useMemo(() => {
    const records: Array<ExtendedLedger> = [];
    for (let i = 0; i < ledgerRecords.length; i++) {
      const { __typename, ...coreRecord } = ledgerRecords[i];
      const ilsBalance =
        i === 0 ? coreRecord.amount.raw : (records[i - 1].ilsBalance ?? 0) + coreRecord.amount.raw;
      const foreignCurrenciesBalance: Record<string, number> = {};
      Object.values(Currency).map(currency => {
        if (currency !== Currency.Ils) {
          const key = `${currency.toLowerCase()}Balance`;
          foreignCurrenciesBalance[key] =
            i === 0
              ? ((coreRecord.foreignAmount?.currency === currency
                  ? coreRecord.foreignAmount?.raw
                  : 0) ?? 0)
              : (records[i - 1]?.[key] ?? 0) +
                (coreRecord.foreignAmount?.currency === currency
                  ? coreRecord.foreignAmount?.raw
                  : 0);
        }
      });
      records.push({
        ...coreRecord,
        ilsBalance,
        ...foreignCurrenciesBalance,
      } as ExtendedLedger);
    }
    return records;
  }, [ledgerRecords]);

  const activeCurrencies = useMemo(
    () =>
      new Set(
        ledgerRecords.filter(t => t.foreignAmount?.currency).map(t => t.foreignAmount!.currency),
      ),
    [ledgerRecords],
  );

  const columns = getAllColumns();

  const initialColumnVisibility = useMemo(
    () => getInitialColumnVisibility(activeCurrencies),
    [activeCurrencies],
  );

  // Load column visibility from localStorage, merge with initial visibility
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.COLUMN_VISIBILITY);
      if (stored) {
        const savedVisibility = JSON.parse(stored);
        // Merge saved visibility with initial visibility (to handle new columns)
        return { ...initialColumnVisibility, ...savedVisibility };
      }
    } catch {
      // Fall through to default
    }
    return initialColumnVisibility;
  });

  // Persist column visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COLUMN_VISIBILITY, JSON.stringify(columnVisibility));
    } catch (error) {
      console.warn('Failed to save column visibility to localStorage:', error);
    }
  }, [columnVisibility]);

  // Update column visibility when initial visibility changes (e.g., new currencies appear)
  useEffect(() => {
    setColumnVisibility(prev => {
      const merged = { ...initialColumnVisibility, ...prev };
      return merged;
    });
  }, [initialColumnVisibility]);

  const table = useReactTable({
    data: extendedLedgerRecords,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
  });

  const businessName = ledgerRecords[0]?.business.name ?? 'unknown';

  if (fetching) {
    return (
      <div className="flex flex-col gap-4 max-w-[90vw]">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[90vw] m-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search reference, details, business..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
              {table
                .getAllColumns()
                .filter(column => column.getCanHide())
                .map(column => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={value => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DownloadCSV
          ledgerRecords={extendedLedgerRecords}
          businessName={businessName}
          fromDate={filter?.fromDate ?? undefined}
          toDate={filter?.toDate ?? undefined}
        />
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-white border-b">
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
            {table.getRowModel().rows?.length ? (
              table
                .getRowModel()
                .rows.map(row => <BusinessExtendedInfoRow key={row.id} row={row} />)
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-700">
            Showing{' '}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}{' '}
            of {table.getFilteredRowModel().rows.length} transactions
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Rows per page:</p>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={value => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[25, 50, 100, 200, 500].map(pageSize => (
                  <SelectItem key={pageSize} value={String(pageSize)}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Pagination
            className="w-fit mx-0"
            currentPageIndex={table.getState().pagination.pageIndex}
            totalPages={table.getPageCount()}
            onChange={page => table.setPageIndex(page)}
          />
        </div>
      </div>
    </div>
  );
}
