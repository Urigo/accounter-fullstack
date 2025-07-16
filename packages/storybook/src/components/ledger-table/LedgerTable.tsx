import React, { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { createColumns } from './columns';
import { LedgerRecordRow, LedgerTableProps, MatchingStatus } from './types';

function getRowColorByStatus(status?: MatchingStatus): string {
  let rowStyle = '';
  switch (status) {
    case 'New':
      rowStyle = 'bg-green-100/30';
      break;
    case 'Deleted':
      rowStyle = 'bg-red-100/30';
      break;
    case 'Diff':
      rowStyle = 'bg-yellow-100/30';
      break;
  }
  return rowStyle;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({ data, onAccountClick }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = createColumns({ onAccountClick });

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
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={getRowColorByStatus(row.original.matchingStatus)}
              >
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
  );
};
