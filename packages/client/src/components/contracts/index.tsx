import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { Pagination } from '@/components/common/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { ContractForContractsTableFieldsFragmentDoc } from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import type { BillingCycle, Product, SubscriptionPlan } from '../../gql/graphql.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { columns } from './columns.js';
import { ContractsFilter } from './contracts-filter.js';
import { IssueDocumentsModal } from './issue-documents-modal.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ContractForContractsTableFields on Contract {
    id
    isActive
    client {
      id
      originalBusiness {
        id
        name
      }
    }
    purchaseOrders
    startDate
    endDate
    amount {
      raw
      formatted
    }
    billingCycle
    product
    plan
    operationsLimit
    msCloud
    # documentType
    # remarks
    # operationsLimit
  }
`;

export interface ContractRow {
  id: string;
  isActive: boolean;
  client: {
    id: string;
    name: string;
  };
  purchaseOrder?: string;
  startDate: TimelessDateString;
  endDate: TimelessDateString;
  amount: {
    raw: number;
    formatted: string;
  };
  billingCycle: BillingCycle;
  product?: Product;
  plan?: SubscriptionPlan;
  operationsLimit?: number;
  msCloud?: string;
  // documentType
  // remarks
  // operationsLimit
}

function convertContractFragmentToTableRow(
  data: FragmentType<typeof ContractForContractsTableFieldsFragmentDoc>,
): ContractRow {
  const fragmentData = getFragmentData(ContractForContractsTableFieldsFragmentDoc, data);
  return {
    id: fragmentData.id,
    isActive: fragmentData.isActive,
    client: {
      id: fragmentData.client.id,
      name: fragmentData.client.originalBusiness.name,
    },
    purchaseOrder: fragmentData.purchaseOrders[0],
    startDate: fragmentData.startDate,
    endDate: fragmentData.endDate,
    amount: {
      raw: fragmentData.amount.raw,
      formatted: fragmentData.amount.formatted,
    },
    billingCycle: fragmentData.billingCycle,
    product: fragmentData.product ?? undefined,
    plan: fragmentData.plan ?? undefined,
    operationsLimit: fragmentData.operationsLimit,
    msCloud: fragmentData.msCloud?.toString() ?? undefined,
  };
}

type Props = {
  data: FragmentType<typeof ContractForContractsTableFieldsFragmentDoc>[];
  onChange?: () => void;
};

export const ContractsTable = ({ data }: Props): ReactElement => {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: 'endDate',
      desc: true,
    },
    {
      id: 'amount.raw',
      desc: true,
    },
  ]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);

  const contracts = useMemo(
    () => data.map(rawContract => convertContractFragmentToTableRow(rawContract)),
    [data],
  );

  const table = useReactTable({
    data: contracts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 50,
      },
    },
  });

  useEffect(() => {
    const selectedIndexes = Object.entries(rowSelection)
      .filter(([, value]) => !!value)
      .map(([key]) => Number(key));
    const newSelectedContractIds = Array.from(
      new Set(contracts.filter((_, i) => selectedIndexes.includes(i)).map(c => c.id)),
    );
    if (
      selectedContractIds.length !== newSelectedContractIds.length ||
      !selectedContractIds.every(id => newSelectedContractIds.includes(id))
    ) {
      setSelectedContractIds(newSelectedContractIds);
    }
  }, [rowSelection, contracts, selectedContractIds, columnFilters]);

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-4">
        <ContractsFilter table={table} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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

        <div className="ml-auto">
          <IssueDocumentsModal contractIds={selectedContractIds} className="ml-auto" />
        </div>
      </div>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <Pagination
          className="w-fit mx-0"
          currentPage={table.getState().pagination.pageIndex}
          totalPages={table.getPageCount()}
          onChange={page => table.setPageIndex(page)}
        />
      </div>
    </div>
  );
};
