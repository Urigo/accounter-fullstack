import { useState, type ReactElement } from 'react';
import { MoreVertical, RefreshCcwDot, Tags } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { useRegenerateLedgerRecords } from '../../hooks/use-regenerate-ledger-records.js';
import { ConfirmationModal } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { ChargesBatchTagsDialog } from './charges-batch-tags-dialog.js';
import type { ChargeRow } from './charges-table.js';

interface Props {
  table: Table<TableFeaturesConfig, ChargeRow>;
  /**
   * Refreshes the given charges. Goes through `ChargesTable`'s refetch registry rather than calling a
   * handler hung off each row, which silently did nothing for selected charges that were not
   * currently rendered — `getSelectedRowModel()` is built from the core row model and so is not
   * limited to the paginated rows on screen.
   */
  onRefreshCharges?: (chargeIds: string[]) => void;
}

/**
 * Bulk-action menu rendered next to the selection column header. Operates on the table's currently
 * selected rows. Exposes batch "Regenerate ledger" (mirrors the per-charge
 * {@link RegenerateLedgerRecordsButton}, confirmation modal included) and "Change tags" (add/remove
 * tags across all selected charges), each in a single request.
 */
export function ChargesBatchActionsMenu({ table, onRefreshCharges }: Props): ReactElement {
  const { regenerateLedgerRecords } = useRegenerateLedgerRecords();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const { rows } = table.getSelectedRowModel();
  const selectedCount = rows.length;
  const selectedIds = rows.map(row => row.original.id);

  // Refresh each selected charge so the list reflects the applied change.
  function refreshSelected(): void {
    onRefreshCharges?.(selectedIds);
  }

  function onRegenerate(): void {
    if (selectedIds.length === 0) {
      return;
    }
    regenerateLedgerRecords(selectedIds).then(refreshSelected);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Batch charge actions"
            onClick={event => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={selectedCount === 0} onSelect={() => setConfirmOpen(true)}>
            <RefreshCcwDot className="size-4" />
            Regenerate ledger
          </DropdownMenuItem>
          <DropdownMenuItem disabled={selectedCount === 0} onSelect={() => setTagsOpen(true)}>
            <Tags className="size-4" />
            Change tags
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationModal
        open={confirmOpen}
        setOpen={setConfirmOpen}
        onConfirm={onRegenerate}
        title={`Are you sure you want to regenerate ledger records for ${selectedCount} selected charge${
          selectedCount === 1 ? '' : 's'
        }?`}
      />
      <ChargesBatchTagsDialog
        chargeIds={selectedIds}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        onDone={refreshSelected}
      />
    </>
  );
}
