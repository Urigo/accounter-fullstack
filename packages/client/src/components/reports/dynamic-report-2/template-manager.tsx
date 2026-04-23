import { useMemo, useRef, useState } from 'react';
import { Check, Copy, Edit2, Lock, Trash2, Upload, X } from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.js';
import { type Template } from './types.js';

interface TemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  onLoad: (template: Template) => void;
  onRename: (template: Template, newName: string) => void;
  onDuplicate: (template: Template) => void;
  onDelete: (template: Template) => void;
}

const columnHelper = createColumnHelper<Template>();

export function TemplateManager({
  open,
  onOpenChange,
  templates,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
}: TemplateManagerProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  function startEditing(template: Template) {
    setEditingId(template.id);
    setEditingName(template.name);
    // Focus the input on the next tick after render
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingName('');
  }

  function submitEditing(template: Template) {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== template.name) {
      onRename(template, trimmed);
    }
    setEditingId(null);
    setEditingName('');
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: info => {
          const template = info.row.original;
          if (editingId === template.id) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  ref={editInputRef}
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitEditing(template);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="h-7 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-green-600 hover:text-green-700"
                  onClick={() => submitEditing(template)}
                  disabled={!editingName.trim()}
                >
                  <Check className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="size-7 p-0" onClick={cancelEditing}>
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          }
          return <span className="font-medium">{info.getValue()}</span>;
        },
      }),
      columnHelper.accessor('lastUpdated', {
        header: 'Last Updated',
        cell: info => {
          const date = info.getValue();
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          );
        },
      }),
      columnHelper.accessor('isLocked', {
        header: 'Locked',
        cell: info =>
          info.getValue() ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>This template is locked</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: info => {
          const template = info.row.original;
          const isEditing = editingId === template.id;
          return (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => {
                        onLoad(template);
                        onOpenChange(false);
                      }}
                      disabled={template.isLocked || isEditing}
                    >
                      <Upload className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {template.isLocked ? 'Cannot load locked template' : 'Load template'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => startEditing(template)}
                      disabled={template.isLocked || isEditing}
                    >
                      <Edit2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {template.isLocked ? 'Cannot rename locked template' : 'Rename template'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => onDuplicate(template)}
                      disabled={isEditing}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate template</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => onDelete(template)}
                      disabled={template.isLocked || isEditing}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {template.isLocked ? 'Cannot delete locked template' : 'Delete template'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onLoad, onRename, onDuplicate, onDelete, onOpenChange, editingId, editingName],
  );

  const table = useReactTable({
    data: templates,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Template Manager</DialogTitle>
          <DialogDescription>Select a template to load, duplicate, or delete.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Filter templates..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map(row => (
                    <TableRow key={row.id} className={row.original.isLocked ? 'bg-muted/30' : ''}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No templates found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
