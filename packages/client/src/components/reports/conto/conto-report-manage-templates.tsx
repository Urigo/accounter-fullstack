import { ReactElement, useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, CloudCog, Loader2, MoreHorizontal } from 'lucide-react';
import { useQuery } from 'urql';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { AllContoReportsDocument, AllContoReportsQuery } from '../../../gql/graphql.js';
import { useDeleteDynamicReportTemplate } from '../../../hooks/use-delete-dynamic-report-template.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu.js';
import { Input } from '../../ui/input.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { TooltipContent } from '../../ui/tooltip.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllContoReports {
    allDynamicReports {
      id
      name
      updated
    }
  }
`;

type RowType = AllContoReportsQuery['allDynamicReports'][number];

interface ContoReportTemplatesProps {
  closeModal: () => void;
  template?: string;
  setTemplate: (template: string) => void;
}

function ContoReportTemplates({
  closeModal,
  setTemplate,
  template,
}: ContoReportTemplatesProps): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // fetch data
  const [{ data, fetching }, fetchTemplates] = useQuery({
    query: AllContoReportsDocument,
  });

  const { deleteDynamicReportTemplate } = useDeleteDynamicReportTemplate();

  const onDeleteTemplate = useCallback(
    async (name: string) => {
      await deleteDynamicReportTemplate({ name });
      fetchTemplates();
    },
    [deleteDynamicReportTemplate, fetchTemplates],
  );

  const onSelectTemplate = useCallback(
    (name: string) => {
      setTemplate(name);
      closeModal();
    },
    [setTemplate, closeModal],
  );

  const columns = useMemo(() => {
    const columns: ColumnDef<RowType>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Name
              <ArrowUpDown />
            </Button>
          );
        },
        cell: ({ row }) => <div className="lowercase">{row.getValue('name')}</div>,
      },
      {
        accessorKey: 'updated',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Last Updated
              <ArrowUpDown />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="lowercase">{format(row.getValue('updated'), 'dd/MM/yyyy HH:mm:ss')}</div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const { name } = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* <DropdownMenuItem>Rename</DropdownMenuItem> */}
                <DropdownMenuItem onClick={() => onDeleteTemplate(name)}>Delete</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSelectTemplate(name)}>Select</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
    return columns;
  }, [onDeleteTemplate, onSelectTemplate]);

  const table = useReactTable({
    data: data?.allDynamicReports || [],
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
  });

  return (
    <div className="w-full h-[450px] relative">
      {fetching && (
        <div className="absolute bg-white/60 z-10 h-full w-full flex items-center justify-center">
          <div className="flex items-center">
            <span className="text-3xl mr-4">
              <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter templates..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={event => table.getColumn('name')?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.original.name === template && 'selected'}>
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
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
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
      </div>
    </div>
  );
}

interface Props {
  template?: string;
  setTemplate: (template: string) => void;
}

export function ManageTemplates({ template, setTemplate }: Props): ReactElement {
  const [opened, setOpened] = useState(false);

  return (
    <Dialog open={opened} onOpenChange={setOpened}>
      <DialogTrigger asChild>
        <TooltipContent content="Save template">
          <Button variant="outline" onClick={(): void => setOpened(true)} className="p-2">
            <CloudCog size={20} />
          </Button>
        </TooltipContent>
      </DialogTrigger>
      <DialogContent className="max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Conto report templates</DialogTitle>
        </DialogHeader>
        <ContoReportTemplates
          closeModal={(): void => setOpened(false)}
          template={template}
          setTemplate={setTemplate}
        />
      </DialogContent>
    </Dialog>
  );
}
