import { ReactElement, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { TableLedgerRecordsFieldsFragment } from '../../gql/graphql.js';
import { EMPTY_UUID } from '../../helpers/consts.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.jsx';
import { columns } from './columns.jsx';

function getRowColorByStatus(status?: 'New' | 'Diff' | 'Deleted'): string {
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

export type LedgerRecordRow = TableLedgerRecordsFieldsFragment['ledger']['records'][number] & {
  matchingStatus?: 'New' | 'Diff' | 'Deleted';
  diff?: TableLedgerRecordsFieldsFragment['ledger']['records'][number];
};

type Props = {
  ledger: TableLedgerRecordsFieldsFragment['ledger'];
};

export const LedgerTable = ({ ledger }: Props): ReactElement => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo(() => {
    const records: LedgerRecordRow[] = ledger.records.map(record => {
      const diff = ledger.validate?.differences?.find(diffRecord => diffRecord.id === record.id);
      return {
        ...record,
        matchingStatus:
          !ledger.validate?.matches || ledger.validate.matches?.some(id => id === record.id)
            ? undefined
            : diff
              ? 'Diff'
              : 'Deleted',
        diff,
      };
    });
    const newRecords: LedgerRecordRow[] =
      ledger?.validate?.differences
        ?.filter(record => record.id === EMPTY_UUID)
        .map(record => ({
          ...record,
          matchingStatus: 'New',
        })) ?? [];
    records.push(...newRecords);
    return records;
  }, [ledger]);

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
  );
};
