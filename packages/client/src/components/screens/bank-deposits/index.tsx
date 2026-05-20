import { useMemo, useRef, useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useQuery } from 'urql';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { DepositDialog } from '@/components/bank-deposits/deposit-dialog.js';
import { DepositsTransactionsTable } from '@/components/bank-deposits/index.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.js';
import { AllDepositsDocument } from '@/gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllDeposits {
    allDeposits {
      id
      name
      currency
      openDate
      closeDate
      isOpen
      metadata {
        id
        currentBalance {
          raw
          formatted
        }
        totalDeposit {
          raw
          formatted
        }
        totalInterest {
          raw
          formatted
        }
        # transactions field exists but we don't need to pull ids here
      }
    }
  }
`;

type DepositRow = {
  id: string;
  name: string;
  currency: string | null;
  openDate: string | null;
  closeDate: string | null;
  isOpen: boolean;
  currentBalanceRaw: number;
  currentBalanceFormatted: string;
  totalDepositRaw: number;
  totalDepositFormatted: string;
  totalInterestRaw: number;
  totalInterestFormatted: string;
};

export function DepositsScreen(): ReactElement {
  const [{ data, fetching }, refetch] = useQuery({ query: AllDepositsDocument });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'openDate', desc: false }]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<DepositRow | null>(null);

  const rows: DepositRow[] = useMemo(() => {
    const deposits = data?.allDeposits ?? [];
    return deposits.map(d => ({
      id: d.id,
      name: d.name,
      currency: d.currency ?? null,
      openDate: d.openDate ?? null,
      closeDate: d.closeDate ?? null,
      isOpen: d.isOpen,
      currentBalanceRaw: d.metadata.currentBalance?.raw ?? 0,
      currentBalanceFormatted: d.metadata.currentBalance?.formatted ?? '',
      totalDepositRaw: d.metadata.totalDeposit?.raw ?? 0,
      totalDepositFormatted: d.metadata.totalDeposit?.formatted ?? '',
      totalInterestRaw: d.metadata.totalInterest?.raw ?? 0,
      totalInterestFormatted: d.metadata.totalInterest?.formatted ?? '',
    }));
  }, [data]);

  const columnsRef = useRef<ColumnDef<DepositRow>[]>([
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => row.toggleExpanded()}
          aria-label={row.getIsExpanded() ? 'Collapse' : 'Expand'}
        >
          {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
        </Button>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Deposit Name',
      cell: info => <span className="font-mono text-xs">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: 'currency',
      header: 'Currency',
    },
    {
      accessorKey: 'isOpen',
      header: 'Status',
      cell: info =>
        info.getValue<boolean>() ? (
          <Badge className="bg-green-600 text-white" variant="secondary">
            Open
          </Badge>
        ) : (
          <Badge variant="secondary">Closed</Badge>
        ),
      sortingFn: (a, b) => Number(a.original.isOpen) - Number(b.original.isOpen),
    },
    {
      accessorKey: 'openDate',
      header: 'Open Date',
      cell: info => <span>{info.getValue<string>()}</span>,
    },
    {
      accessorKey: 'closeDate',
      header: 'Close Date',
      cell: info => <span>{info.getValue<string | null>() ?? '-'}</span>,
      sortingFn: (a, b) => {
        const av = a.original.closeDate ?? '';
        const bv = b.original.closeDate ?? '';
        return av.localeCompare(bv);
      },
    },
    {
      id: 'totalDeposit',
      header: 'Total Deposit',
      accessorFn: row => row.totalDepositRaw,
      cell: info => <span className="tabular-nums">{info.row.original.totalDepositFormatted}</span>,
      sortingFn: (a, b) => a.original.totalDepositRaw - b.original.totalDepositRaw,
    },
    {
      id: 'currentBalance',
      header: 'Current Balance',
      accessorFn: row => row.currentBalanceRaw,
      cell: info => (
        <span className="tabular-nums">{info.row.original.currentBalanceFormatted}</span>
      ),
      sortingFn: (a, b) => a.original.currentBalanceRaw - b.original.currentBalanceRaw,
    },
    {
      id: 'totalInterest',
      header: 'Total Interest',
      accessorFn: row => row.totalInterestRaw,
      cell: info => (
        <span className="tabular-nums">{info.row.original.totalInterestFormatted}</span>
      ),
      sortingFn: (a, b) => a.original.totalInterestRaw - b.original.totalInterestRaw,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation();
                setEditingDeposit(row.original);
              }}
              aria-label="Edit deposit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit deposit</TooltipContent>
        </Tooltip>
      ),
      enableSorting: false,
    },
  ]);
  const columns = columnsRef.current;

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  return (
    <div className="max-w-[95vw]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bank Deposits</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Deposit
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border">
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
            {fetching ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <>
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() ? (
                    <TableRow>
                      <TableCell colSpan={columns.length}>
                        <DepositsTransactionsTable
                          depositId={row.original.id}
                          enableReassign
                          refetch={refetch}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </>
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

      <DepositDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => refetch({ requestPolicy: 'network-only' })}
      />

      <DepositDialog
        open={!!editingDeposit}
        onOpenChange={open => {
          if (!open) setEditingDeposit(null);
        }}
        deposit={editingDeposit ?? undefined}
        onSuccess={() => refetch({ requestPolicy: 'network-only' })}
      />
    </div>
  );
}
