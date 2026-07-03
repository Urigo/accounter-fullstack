import { useState, type ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { useDeleteBusiness } from '../../hooks/use-delete-business.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog.js';
import { Button } from '../ui/button.js';
import {
  isBusinessUnused,
  type BusinessTableMeta,
  type BusinessTableRow,
} from './business-rows.js';

interface BusinessRowActionsProps {
  row: BusinessTableRow;
  table: Table<BusinessTableRow>;
}

export function BusinessRowActions({ row, table }: BusinessRowActionsProps): ReactElement {
  const [open, setOpen] = useState(false);
  const { fetching, deleteBusiness } = useDeleteBusiness();
  const meta = table.options.meta as BusinessTableMeta | undefined;
  // Only unused businesses may be deleted; usage must be loaded (non-null) and all zero.
  const canDelete = isBusinessUnused(row);

  const onConfirm = async (): Promise<void> => {
    const deleted = await deleteBusiness({ businessId: row.id });
    if (deleted) {
      setOpen(false);
      meta?.refetchBusinesses?.();
    }
  };

  // A disabled <button> swallows pointer events, so a native `title` tooltip never shows. When
  // deletion isn't allowed, render the disabled button inside a hoverable span that carries the
  // tooltip, and skip the AlertDialog wrapper entirely (nothing can open it).
  if (!canDelete) {
    return (
      <span
        title="Only unused businesses can be deleted — enable a usage column to load usage"
        className="inline-block cursor-not-allowed"
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700 pointer-events-none"
          disabled
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </span>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700"
          title="Delete business"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{row.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the business and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={event => {
              event.preventDefault();
              void onConfirm();
            }}
            disabled={fetching}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
