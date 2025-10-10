import { useMemo, useState, type ReactElement } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { TransactionForTransactionsTableFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { EditTransactionModal } from '../common/index.js';
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
  onChange = (): void => void 0,
  enableEdit,
  enableChargeLink,
}: Props): ReactElement => {
  const [editTransactionId, setEditTransactionId] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  const transactions = useMemo(
    () =>
      transactionsProps.map(rawTransaction =>
        getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, rawTransaction),
      ),
    [transactionsProps],
  );

  const data: TransactionsTableRowType[] = useMemo(
    () =>
      transactions?.map(transaction => ({
        ...transaction,
        editTransaction: (): void => setEditTransactionId(transaction.id),
        onUpdate: onChange,
        enableEdit,
        enableChargeLink,
      })),
    [transactions, onChange, enableEdit, enableChargeLink],
  );

  const tableColumns = useMemo(
    () => (enableEdit || enableChargeLink ? [...columns, actionsColumn] : columns),
    [enableEdit, enableChargeLink],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
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
      <EditTransactionModal
        transactionID={editTransactionId}
        close={() => setEditTransactionId(undefined)}
        onChange={onChange}
      />
    </>
  );
};
