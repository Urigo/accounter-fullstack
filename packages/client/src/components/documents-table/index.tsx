import { useEffect, useMemo, useState, type ReactElement } from 'react';
import equal from 'deep-equal';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  TableDocumentsRowFieldsFragmentDoc,
  type TableDocumentsRowFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
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

  const incomingDocuments = useMemo(
    () =>
      documentsProps?.map(rawDocument =>
        getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument),
      ) ?? [],
    [documentsProps],
  );

  // The document row fields are fetched under a `@defer` fragment, so on a
  // refetch each document streams back id-first and its other fields (amount,
  // vat, …) arrive in later patches — the not-yet-arrived fields are absent from
  // the payload. Merge each incoming document's present fields over the version
  // currently shown (matched by id) so every cell keeps its value until the real
  // data replaces it, instead of the rows flashing empty while only the id is
  // present. Present values (including a legitimate `null`) are applied as they
  // arrive; only absent/`undefined` fields fall back to the previous value. Bail
  // out when nothing changed so we don't re-render (and "blink") on an identical
  // refetch.
  const [documents, setDocuments] = useState<TableDocumentsRowFieldsFragment[]>(incomingDocuments);
  useEffect(() => {
    setDocuments(prev => {
      const prevById = new Map(prev.map(document => [document.id, document]));
      const next = incomingDocuments.map(document => {
        const previous = prevById.get(document.id);
        if (!previous) {
          return document;
        }
        const merged: Record<string, unknown> = { ...previous };
        for (const [key, value] of Object.entries(document)) {
          if (value !== undefined) {
            merged[key] = value;
          }
        }
        return merged as TableDocumentsRowFieldsFragment;
      });
      return equal(prev, next) ? prev : next;
    });
  }, [incomingDocuments]);

  const data: DocumentsTableRowType[] = useMemo(
    () =>
      documents.map(document => ({
        ...document,
        editDocument: (): void => setEditDocumentId(document.id),
        onUpdate: onChange ?? (() => {}),
      })),
    [documents, onChange],
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
