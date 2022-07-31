import { Paper, Table as MantineTable } from '@mantine/core';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtual } from '@tanstack/react-virtual';
import { ReactNode, useRef, useState } from 'react';

import { Button } from './button';

export interface AccounterTableProps<T> {
  items: Array<T>;
  columns: ColumnDef<T>[];

  highlightOnHover?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  moreInfo?: (item: T) => ReactNode;
  showButton?: boolean;
}

export function Table<T>({
  columns,
  items,
  stickyHeader,
  moreInfo,
  highlightOnHover,
  striped,
  showButton,
}: AccounterTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [opened, setOpen] = useState<string | null>(null);
  const [isShowAll, setShowAll] = useState(false);

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtual({
    parentRef: tableContainerRef,
    size: rows.length,
    overscan: 5,
  });
  const { virtualItems: virtualRows, totalSize } = rowVirtualizer;

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

  return (
    <>
      {showButton === true ? (
        <button
          className="inline-flex text-white bg-indigo-500 border-0 py-1.5 px-3 focus:outline-none hover:bg-indigo-600 rounded text-sm"
          type="button"
          onClick={() => {
            setShowAll(prev => !prev);
          }}
        >
          {isShowAll ? 'Hide All' : 'Show All'}
        </button>
      ) : null}
      <div ref={tableContainerRef}>
        <MantineTable striped={striped} highlightOnHover={highlightOnHover}>
          <thead style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 20 } : {}}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr
                key={headerGroup.id}
                className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl"
              >
                {headerGroup.headers.map(header => {
                  return (
                    <th key={header.id} colSpan={header.colSpan} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : (
                        <button
                          className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' 🔼',
                            desc: ' 🔽',
                          }[header.column.getIsSorted() as string] ?? null}
                        </button>
                      )}
                    </th>
                  );
                })}
                {moreInfo && <th>More Info</th>}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualRows.map(virtualRow => {
              const row = rows[virtualRow.index] as Row<T>;
              return (
                <>
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => {
                      return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                    })}
                    {moreInfo && (
                      <td>
                        <Button
                          title="Ledger Info"
                          onClick={() => {
                            setShowAll(false);
                            setOpen(opened === row.id ? null : row.id);
                          }}
                        />
                      </td>
                    )}
                  </tr>
                  {(isShowAll || opened === row.id) && moreInfo && (
                    <tr>
                      <td colSpan={6}>
                        <Paper style={{ width: '100%' }} withBorder shadow="lg">
                          {moreInfo(row.original)}
                        </Paper>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </MantineTable>
      </div>
    </>
  );
}
