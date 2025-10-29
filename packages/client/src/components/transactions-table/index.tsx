import { useMemo, useState, type ReactElement } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { TransactionForTransactionsTableFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { EditTransactionModal } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { actionsColumn, columns, type TransactionsTableRowType } from './columns.js';

type Props = {
  transactionsProps: FragmentType<typeof TransactionForTransactionsTableFieldsFragmentDoc>[];
  enableEdit?: boolean;
  enableChargeLink?: boolean;
  onChange?: () => void;
};

export const TransactionsTable = ({
  transactionsProps,
  onChange,
  enableEdit,
  enableChargeLink,
}: Props): ReactElement => {
  const [editTransactionId, setEditTransactionId] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  const transactions = useMemo(() => {
    console.log('rendering Transactions');
    return transactionsProps.map(rawTransaction => {
      return getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, rawTransaction);
    });
  }, [transactionsProps]);

  const data: TransactionsTableRowType[] = useMemo(() => {
    console.log('rendering TransactionsTable data');
    return transactions.map(transaction => {
      return {
        ...transaction,
        editTransaction: setEditTransactionId,
        onUpdate: onChange || (() => {}),
        enableEdit,
        enableChargeLink,
      };
    });
  }, [transactions, enableEdit, enableChargeLink, onChange]);

  const tableColumns = useMemo(() => {
    console.log('rendering tableColumns');
    return enableEdit || enableChargeLink ? [...columns, actionsColumn] : columns;
  }, [enableEdit, enableChargeLink]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 100,
      },
      sorting: [
        {
          id: 'eventDate',
          desc: true,
        },
      ],
    },
  });

  return (
    <>
      <Table
      //  className="w-full h-full"
      >
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
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
      <EditTransactionModal
        transactionID={editTransactionId}
        close={() => setEditTransactionId(undefined)}
        onChange={onChange ?? (() => {})}
      />
    </>
  );
};
