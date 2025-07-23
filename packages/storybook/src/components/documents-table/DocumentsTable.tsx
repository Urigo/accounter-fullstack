import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import {
  AmountCell,
  CreditorCell,
  DateCell,
  DebtorCell,
  FilesCell,
  SerialCell,
  TypeCell,
  VatCell,
} from './cells';
import { DocumentsTableProps, DocumentsTableRowType } from './types';

// Create columns definition
const createColumns = (): ColumnDef<DocumentsTableRowType>[] => [
  {
    accessorKey: 'date',
    sortingFn: (rowA, rowB) => {
      const dateA =
        'date' in rowA.original && rowA.original.date ? new Date(rowA.original.date).getTime() : 0;
      const dateB =
        'date' in rowB.original && rowB.original.date ? new Date(rowB.original.date).getTime() : 0;
      return dateA - dateB;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <DateCell document={row.original} />,
  },
  {
    accessorKey: 'amount.raw',
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
    cell: ({ row }) => <AmountCell document={row.original} />,
  },
  {
    accessorKey: 'vat.raw',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          VAT
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <VatCell document={row.original} />,
  },
  {
    accessorKey: 'documentType',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Type
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <TypeCell document={row.original} />,
  },
  {
    accessorKey: 'serialNumber',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Serial
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <SerialCell document={row.original} />,
  },
  {
    accessorKey: 'creditor.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Creditor
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <CreditorCell document={row.original} />,
  },
  {
    accessorKey: 'debtor.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Debtor
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <DebtorCell document={row.original} />,
  },
  {
    accessorKey: 'file',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Files
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => <FilesCell document={row.original} />,
  },
  {
    accessorKey: 'id',
    header: 'Edit',
    cell: ({ row }) => {
      return (
        <Button variant="ghost" size="icon" onClick={row.original.editDocument} className="h-8 w-8">
          <Edit2 className="h-4 w-4" />
        </Button>
      );
    },
  },
];

export const DocumentsTable: React.FC<DocumentsTableProps> = ({ data }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = createColumns();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="w-full">
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
                No documents found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
