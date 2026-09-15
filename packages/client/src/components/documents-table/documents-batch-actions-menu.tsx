import { useState, type ReactElement } from 'react';
import { MoreVertical, ScanText, Trash } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { useDeleteDocument } from '../../hooks/use-delete-document.js';
import { useReprocessDocumentOcr } from '../../hooks/use-reprocess-document-ocr.js';
import { ConfirmationModal } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import type { DocumentsTableRowType } from './columns.js';

/**
 * Mirror of `MAX_REPROCESS_OCR_BATCH` in
 * `packages/server/src/modules/documents/helpers/reprocess-ocr.helper.ts`. The server rejects a
 * larger request outright, so the selection is trimmed here and the remainder reported, rather than
 * sending a batch that is guaranteed to fail.
 */
const MAX_OCR_BATCH = 20;

interface Props {
  table: Table<TableFeaturesConfig, DocumentsTableRowType>;
}

/**
 * Bulk-action menu rendered next to the selection column header, operating on the table's selected
 * rows. Selection is keyed by document id, so it holds across paging, sorting and filtering, and a
 * batch can be assembled from more than one page.
 */
export function DocumentsBatchActionsMenu({ table }: Props): ReactElement {
  const { batchReprocessDocumentsOcr } = useReprocessDocumentOcr();
  const { batchDeleteDocuments } = useDeleteDocument();
  const [ocrConfirmOpen, setOcrConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { rows } = table.getSelectedRowModel();
  const selectedCount = rows.length;
  const selectedIds = rows.map(row => row.original.id);

  // Every row's `onUpdate` is the same screen-level refetch, so this is called once rather than per
  // row — iterating would fire one identical request per selected document. It is read at call time
  // rather than closed over: after an awaited mutation a refreshed row has been swapped for a new
  // object, and the captured one's callback is an inert stub.
  function refresh(): void {
    table.getSelectedRowModel().rows[0]?.original.onUpdate();
  }

  const ocrBatch = selectedIds.slice(0, MAX_OCR_BATCH);
  const ocrOverflow = selectedIds.length - ocrBatch.length;

  function onReprocess(): void {
    if (ocrBatch.length === 0) {
      return;
    }
    batchReprocessDocumentsOcr(ocrBatch).then(refresh);
  }

  function onDelete(): void {
    if (selectedIds.length === 0) {
      return;
    }
    batchDeleteDocuments(selectedIds).then(result => {
      if (!result) {
        return;
      }
      // The deleted rows are gone, so a selection still pointing at them would leave the batch menu
      // acting on documents that no longer exist.
      table.resetRowSelection();
      refresh();
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
            aria-label="Batch document actions"
            onClick={event => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={selectedCount === 0} onSelect={() => setOcrConfirmOpen(true)}>
            <ScanText className="size-4" />
            Re-run OCR
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={selectedCount === 0}
            onSelect={() => setDeleteConfirmOpen(true)}
          >
            <Trash className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationModal
        open={ocrConfirmOpen}
        setOpen={setOcrConfirmOpen}
        onConfirm={onReprocess}
        title={`Re-run OCR for ${ocrBatch.length} selected document${
          ocrBatch.length === 1 ? '' : 's'
        }?${ocrOverflow > 0 ? ` (${ocrOverflow} more will need a second run)` : ''}`}
      />
      <ConfirmationModal
        open={deleteConfirmOpen}
        setOpen={setDeleteConfirmOpen}
        onConfirm={onDelete}
        title={`Are you sure you want to delete ${selectedCount} selected document${
          selectedCount === 1 ? '' : 's'
        }?`}
      />
    </>
  );
}
