import { useMemo, useState, type ReactElement } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { TableDocumentsRowFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { useStableValue } from '../../hooks/use-stable-value.js';
import { EditDocumentModal } from '../common/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns, type DocumentsTableRowType } from './columns.js';

type Props = {
  documentsProps: FragmentType<typeof TableDocumentsRowFieldsFragmentDoc>[];
  onChange?: () => void;
  limited?: boolean;
};

export const DocumentsTable = ({
  documentsProps,
  onChange,
  limited = false,
}: Props): ReactElement => {
  const [editDocumentId, setEditDocumentId] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Keep a deeply-equal-stable reference for the incoming documents so the table
  // only rebuilds its rows when they actually changed — not on every parent
  // refetch (e.g. after updating a document, the charge query re-runs and yields
  // a fresh array with identical content), which would otherwise re-render and
  // "blink" the whole table.
  const stableDocumentsProps = useStableValue(documentsProps);

  const data: DocumentsTableRowType[] = useMemo(
    () =>
      stableDocumentsProps?.map(rawDocument => {
        const document = getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument);
        return {
          ...document,
          editDocument: (): void => setEditDocumentId(document.id),
          onUpdate: onChange ?? (() => {}),
        };
      }),
    [stableDocumentsProps, onChange],
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
        onChange={() => onChange?.()}
      />
    </>
  );
};
