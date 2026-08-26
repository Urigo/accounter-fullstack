import type { ReactElement } from 'react';
import { flexRender, type RowData, type Table as TableType } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';

type Props<TData extends RowData> = {
  table: TableType<TableFeaturesConfig, TData>;
};

/**
 * Presentational shell for the documents table, shared by `DocumentsTable` and by screens that
 * build the table themselves via `useDocumentsTable` so they can host their own toolbar.
 */
export function DocumentsDataTable<TData extends RowData>({ table }: Props<TData>): ReactElement {
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
