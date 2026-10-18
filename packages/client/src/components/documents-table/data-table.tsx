import { useEffect, useRef, type ReactElement } from 'react';
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
 * highlight is `data-viewing` plus an inset ring, so `data-state` stays free for row selection and
 * the row keeps whatever background its caller gave it.
 */
/** The viewing outline's width and its edges on a cell, as inset box-shadow offsets. */
const OUTLINE_PX = 2;
const OUTLINE_EDGES = {
  top: `0 ${OUTLINE_PX}px`,
  bottom: `0 -${OUTLINE_PX}px`,
  left: `${OUTLINE_PX}px 0`,
  right: `-${OUTLINE_PX}px 0`,
};

/**
 * The viewing outline for one cell: top and bottom edges on every cell, plus the left edge on the
 * first and the right edge on the last. On the cells rather than the `<tr>`, where a ring can be
 * clipped or painted over by cell backgrounds depending on the browser. The colour comes from the
 * row's `--viewing-outline`, so dark mode can change it.
 */
export function viewingOutline(index: number, count: number): string {
  const edges = [OUTLINE_EDGES.top, OUTLINE_EDGES.bottom];
  if (index === 0) {
    edges.push(OUTLINE_EDGES.left);
  }
  if (index === count - 1) {
    edges.push(OUTLINE_EDGES.right);
  }
  return edges.map(edge => `inset ${edge} 0 0 var(--viewing-outline)`).join(', ');
}

export function DocumentsTableRow<TData extends { id: string }>({
  row,
  className,
}: DocumentsTableRowProps<TData>): ReactElement {
  const viewing = useDocumentViewer(s => s.current?.id === row.original.id);
  const cells = row.getVisibleCells();

  return (
    <TableRow
      data-state={row.getIsSelected() ? 'selected' : undefined}
      data-viewing={viewing || undefined}
      className={cn(
        className,
        // An outline, not a background: a background would replace the row's own tint (twMerge
        // drops e.g. the "linked document" `bg-blue-100`), and hover and selection backgrounds
        // would fight it. The outline is drawn on the cells (below), over all of them.
        viewing &&
          '[--viewing-outline:var(--color-blue-500)] dark:[--viewing-outline:var(--color-blue-400)]',
      )}
    >
      {cells.map((cell, index) => (
        <TableCell
          key={cell.id}
          style={viewing ? { boxShadow: viewingOutline(index, cells.length) } : undefined}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Tells the viewer when this table's rows change, so a sibling snapshot taken from it is dropped
 * once the document shown leaves the table (a delete, a filter, another page). The first render
 * only records the ids. Pass the ids of `getRowModel().rows`, in order.
 *
 * `null` means "rows unknown right now" (a refetch in flight) and is skipped without being
 * recorded, so the first result after it is compared with the last ids before it. A screen that
 * swaps its table for a spinner while fetching must call this from the always-mounted parent:
 * inside the table it would remount with nothing recorded and never reconcile.
 */
export function useReconcileViewerRows(rowIds: readonly string[] | null): void {
  const reconcile = useDocumentViewer(s => s.reconcileRowIds);
  const prevRef = useRef<readonly string[] | null>(null);
  // A string key, so a fresh array with the same ids doesn't re-run the effect.
  const key = rowIds === null ? null : rowIds.join('\n');
  useEffect(() => {
    if (key === null) {
      return;
    }
    const next = key === '' ? [] : key.split('\n');
    const prev = prevRef.current;
    prevRef.current = next;
    if (prev) {
      reconcile(prev, next);
    }
  }, [key, reconcile]);
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
  const { rows } = table.getRowModel();
  useReconcileViewerRows(rows.map(row => row.id));

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
        {rows.length ? (
          rows.map(row => <DocumentsTableRow key={row.id} row={row} />)
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
