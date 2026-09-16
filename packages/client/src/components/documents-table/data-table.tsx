import type { ReactElement } from 'react';
import { flexRender, type RowData, type Table as TableType } from '@tanstack/react-table';
import type { AnyTable, TableFeaturesConfig } from '@/lib/table-features.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';

type Props<TData extends RowData> = {
  table: AnyTable<TData>;
};

/**
 * Presentational shell for the documents table, shared by `DocumentsTable` and by screens that
 * build the table themselves via `useDocumentsTable` so they can host their own toolbar.
 *
 * Takes a table from either feature set: the embedded `DocumentsTable` is unpaginated while the
 * all-documents screen paginates, and `Table` is invariant in the feature set.
 */
export function DocumentsDataTable<TData extends RowData>({
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
            <TableCell colSpan={columnCount} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
