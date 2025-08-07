import { ReactElement, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import { TableDocumentsRowFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { EditDocumentModal } from '../common/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns, DocumentsTableRowType } from './columns.js';

type Props = {
  documentsProps: FragmentType<typeof TableDocumentsRowFieldsFragmentDoc>[];
  onChange: () => void;
  limited?: boolean;
};

export const DocumentsTable = ({
  documentsProps,
  onChange,
  limited = false,
}: Props): ReactElement => {
  const [editDocumentId, setEditDocumentId] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  const data: DocumentsTableRowType[] = useMemo(
    () =>
      documentsProps?.map(rawDocument => {
        const document = getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument);
        return {
          ...document,
          editDocument: (): void => setEditDocumentId(document.id),
          onUpdate: onChange,
        };
      }),
    [documentsProps, onChange],
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const limitedColumns = ['date', 'amount', 'vat', 'type', 'serial', 'file'];
  const table = useReactTable({
    data,
    columns: limited
      ? columns.filter(column => column.id && limitedColumns.includes(column.id))
      : columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  });

  return (
    <>
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
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <EditDocumentModal
        documentId={editDocumentId}
        onDone={(): void => setEditDocumentId(undefined)}
        onChange={onChange}
      />
    </>
  );
};
