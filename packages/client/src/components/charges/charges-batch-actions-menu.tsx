import { useState, type ReactElement } from 'react';
import { MoreVertical, RefreshCcwDot } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { useRegenerateLedgerRecords } from '../../hooks/use-regenerate-ledger-records.js';
import { ConfirmationModal } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import type { ChargeRow } from './charges-table.js';

interface Props {
  table: Table<ChargeRow>;
}

/**
 * Bulk-action menu rendered next to the selection column header. Operates on the table's currently
 * selected rows. Currently exposes a single action — batch "Regenerate ledger" — which mirrors the
 * per-charge {@link RegenerateLedgerRecordsButton} (confirmation modal included) for every selected
 * charge in one request.
 */
export function ChargesBatchActionsMenu({ table }: Props): ReactElement {
  const { regenerateLedgerRecords } = useRegenerateLedgerRecords();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedCount = table.getSelectedRowModel().rows.length;

  function onRegenerate(): void {
    const rows = table.getSelectedRowModel().rows;
    if (rows.length === 0) {
      return;
    }
    regenerateLedgerRecords(rows.map(row => row.original.id)).then(() => {
      // Refresh each affected row so the table reflects the regenerated ledger.
      rows.forEach(row => row.original.onChange());
    });
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
          <DropdownMenuItem
            disabled={selectedCount === 0}
            onSelect={() => setConfirmOpen(true)}
          >
            <RefreshCcwDot className="size-4" />
            Regenerate ledger
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
    </>
  );
}
