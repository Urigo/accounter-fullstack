import type { ReactElement } from 'react';
import { flexRender, type Row, type RowData, type Table as TableType } from '@tanstack/react-table';
import { useDocumentViewer } from '@/hooks/use-document-viewer.js';
import type { AnyTable, TableFeaturesConfig } from '@/lib/table-features.js';
import { cn } from '@/lib/utils.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';

type Props<TData extends RowData & { id: string }> = {
  table: AnyTable<TData>;
};

type DocumentsTableRowProps<TData extends { id: string }> = {
  row: Row<TableFeaturesConfig, TData>;
  className?: string;
};

/**
 * One documents-table row. It highlights while its document is open in the shared viewer.
 *
 * The boolean selector means a swap re-renders only the two rows whose answer changed. The
 * highlight is `data-viewing`, so `data-state` stays free for row selection.
 */
export function DocumentsTableRow<TData extends { id: string }>({
  row,
  className,
}: DocumentsTableRowProps<TData>): ReactElement {
  const viewing = useDocumentViewer(s => s.current?.id === row.original.id);

  return (
    <TableRow
      data-state={row.getIsSelected() ? 'selected' : undefined}
      data-viewing={viewing || undefined}
      className={cn(
        className,
        // The selected-state variants too: `TableRow`'s `data-[state=selected]:bg-gray-100` is more
        // specific than a plain background, so a selected row would otherwise lose the highlight.
        viewing &&
          'bg-blue-50 hover:bg-blue-50 data-[state=selected]:bg-blue-50 dark:bg-blue-950/40 dark:hover:bg-blue-950/40 dark:data-[state=selected]:bg-blue-950/40',
      )}
    >
      {row.getVisibleCells().map(cell => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Presentational shell for the documents table, shared by `DocumentsTable` and by screens that
 * build the table themselves via `useDocumentsTable` so they can host their own toolbar.
 *
 * Takes a table from either feature set: the embedded `DocumentsTable` is unpaginated while the
 * all-documents screen paginates, and `Table` is invariant in the feature set.
 */
export function DocumentsDataTable<TData extends RowData & { id: string }>({
  table: tableFromEitherSet,
}: Props<TData>): ReactElement {
  // The markup below touches only core APIs — header groups, the row model, cells — which both
  // feature sets share. Narrowing to one concrete set is what lets `flexRender` pair a column
  // template with its context: across the union TypeScript cannot match the two pairwise.
  const table = tableFromEitherSet as TableType<TableFeaturesConfig, TData>;

  // Visible leaf columns only: `getAllColumns()` counts hidden and group columns too, so the
  // empty-state cell would outspan the rendered header once a column is hidden.
  const columnCount = table.getVisibleLeafColumns().length;

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
          table.getRowModel().rows.map(row => <DocumentsTableRow key={row.id} row={row} />)
        ) : (
          <TableRow>
            <TableCell colSpan={columnCount} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
