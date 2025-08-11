import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { AmountCell } from './amount-cell.jsx';
import { CounterpartyCell } from './counterparty-cell.jsx';
import { DateCell } from './date-cell.jsx';
import type { LedgerRecordRow } from './index.js';

export const columns: ColumnDef<LedgerRecordRow>[] = [
  {
    accessorKey: 'invoiceDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Invoice Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <DateCell date={row.original.invoiceDate} diff={row.original.diff?.invoiceDate} />;
    },
  },
  {
    accessorKey: 'valueDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Value Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <DateCell date={row.original.valueDate} diff={row.original.diff?.valueDate} />;
    },
  },
  {
    header: 'Debit Account1',
    columns: [
      {
        accessorKey: 'debitAccount1.name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Account
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <CounterpartyCell
              account={row.original.debitAccount1}
              diffAccount={row.original.diff?.debitAccount1}
            />
          );
        },
      },
      {
        accessorKey: 'localCurrencyDebitAmount1.raw',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Amount
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <AmountCell
              foreignAmount={row.original.debitAmount1}
              localAmount={row.original.localCurrencyDebitAmount1}
              diff={
                row.original.diff
                  ? {
                      foreignAmount: row.original.diff.debitAmount1,
                      localAmount: row.original.diff.localCurrencyDebitAmount1,
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
  },
  {
    header: 'Credit Account1',
    columns: [
      {
        accessorKey: 'creditAccount1.name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Account
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <CounterpartyCell
              account={row.original.creditAccount1}
              diffAccount={row.original.diff?.creditAccount1}
            />
          );
        },
      },
      {
        accessorKey: 'localCurrencyCreditAmount1.raw',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Amount
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <AmountCell
              foreignAmount={row.original.creditAmount1}
              localAmount={row.original.localCurrencyCreditAmount1}
              diff={
                row.original.diff
                  ? {
                      foreignAmount: row.original.diff.creditAmount1,
                      localAmount: row.original.diff.localCurrencyCreditAmount1,
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
  },
  {
    header: 'Debit Account2',
    columns: [
      {
        accessorKey: 'debitAccount2.name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Account
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <CounterpartyCell
              account={row.original.debitAccount2}
              diffAccount={row.original.diff?.debitAccount2}
            />
          );
        },
      },
      {
        accessorKey: 'localCurrencyDebitAmount2.raw',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Amount
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <AmountCell
              foreignAmount={row.original.debitAmount2}
              localAmount={row.original.localCurrencyDebitAmount2}
              diff={
                row.original.diff
                  ? {
                      foreignAmount: row.original.diff.debitAmount2,
                      localAmount: row.original.diff.localCurrencyDebitAmount2,
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
  },
  {
    header: 'Credit Account2',
    columns: [
      {
        accessorKey: 'creditAccount2.name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Account
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <CounterpartyCell
              account={row.original.creditAccount2}
              diffAccount={row.original.diff?.creditAccount2}
            />
          );
        },
      },
      {
        accessorKey: 'localCurrencyCreditAmount2.raw',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Amount
              {column.getIsSorted() &&
                (column.getIsSorted() === 'asc' ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ))}
            </Button>
          );
        },
        cell: ({ row }) => {
          return (
            <AmountCell
              foreignAmount={row.original.creditAmount2}
              localAmount={row.original.localCurrencyCreditAmount2}
              diff={
                row.original.diff
                  ? {
                      foreignAmount: row.original.diff.creditAmount2,
                      localAmount: row.original.diff.localCurrencyCreditAmount2,
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
  },
  {
    accessorKey: 'description',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Details
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row: { original } }) => {
      const isDiff = original.diff && original.diff.description !== original.description;
      return (
        <div className="flex flex-col whitespace-normal">
          <p className={isDiff ? 'line-through' : ''}>{original.description}</p>
          {isDiff && (
            <div className="border-2 border-yellow-500 rounded-md">
              {original.diff?.description}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'reference',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Reference
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row: { original } }) => {
      const isDiff = original.diff && original.diff.reference !== original.reference;
      return (
        <div className="flex flex-col whitespace-normal">
          <p className={isDiff ? 'line-through' : ''}>{original.reference}</p>
          {isDiff && (
            <div className="border-2 border-yellow-500 rounded-md">{original.diff?.reference}</div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'matchingStatus',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Status
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({
      row: {
        original: { matchingStatus },
      },
    }) => {
      if (matchingStatus) {
        const color =
          matchingStatus === 'Deleted'
            ? 'bg-red-500'
            : matchingStatus === 'Diff'
              ? 'bg-yellow-500'
              : 'bg-green-500';
        return (
          <Badge variant="default" className={color}>
            {matchingStatus}
          </Badge>
        );
      }
      return null;
    },
  },
];
