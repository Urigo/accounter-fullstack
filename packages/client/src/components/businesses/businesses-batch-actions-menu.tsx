import { useState, type ReactElement } from 'react';
import { MoreVertical, PencilLine, Tags } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { BatchUpdateBusinessesTagsDialog } from './batch-tags-dialog.js';
import { BatchUpdateBusinessesDialog } from './batch-update-dialog.js';
import type { BusinessTableMeta, BusinessTableRow } from './business-rows.js';

interface Props {
  table: Table<BusinessTableRow>;
}

/**
 * Bulk-action menu rendered next to the selection column header, mirroring
 * {@link ChargesBatchActionsMenu}. Operates on the table's currently selected rows and exposes
 * "Update fields" (locality, sort code, default tax category and the boolean flags) and
 * "Change tags" (add/remove suggestion tags), each applied in a single request.
 */
export function BusinessesBatchActionsMenu({ table }: Props): ReactElement {
  const [updateOpen, setUpdateOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const selectedIds = table.getSelectedRowModel().rows.map(row => row.original.id);
  const selectedCount = selectedIds.length;
  const meta = table.options.meta as BusinessTableMeta | undefined;

  // Refresh the table and drop the selection, so the applied change is visible and the rows aren't
  // left selected for an accidental second apply.
  function onApplied(): void {
    meta?.refetchBusinesses?.();
    table.resetRowSelection();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Batch business actions"
            onClick={event => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={selectedCount === 0} onSelect={() => setUpdateOpen(true)}>
            <PencilLine className="size-4" />
            Update fields
          </DropdownMenuItem>
          <DropdownMenuItem disabled={selectedCount === 0} onSelect={() => setTagsOpen(true)}>
            <Tags className="size-4" />
            Change tags
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BatchUpdateBusinessesDialog
        businessIds={selectedIds}
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        onDone={onApplied}
      />
      <BatchUpdateBusinessesTagsDialog
        businessIds={selectedIds}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        onDone={onApplied}
      />
    </>
  );
}
