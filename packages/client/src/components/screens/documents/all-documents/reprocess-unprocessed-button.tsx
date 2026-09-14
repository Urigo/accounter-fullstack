import { useState, type ReactElement } from 'react';
import { ScanText } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { DocumentType } from '../../../../gql/graphql.js';
import { useReprocessDocumentOcr } from '../../../../hooks/use-reprocess-document-ocr.js';
import { ConfirmationModal } from '../../../common/index.js';
import type { DocumentsTableRowType } from '../../../documents-table/columns.js';
import { Button } from '../../../ui/button.js';

/**
 * Mirror of `MAX_REPROCESS_OCR_BATCH` in
 * `packages/server/src/modules/documents/helpers/reprocess-ocr.helper.ts`. The server rejects a
 * larger request outright, so the list is trimmed here and the remainder reported, rather than
 * sending a batch that is guaranteed to fail.
 */
const MAX_BATCH = 20;

interface Props {
  table: Table<TableFeaturesConfig, DocumentsTableRowType>;
  onChange: () => void;
}

/**
 * Bulk re-OCR over the unprocessed documents currently listed.
 *
 * The documents table has no row selection, so the filter bar is the selection mechanism: narrowing
 * to "Invalid documents only" lists exactly the documents this is meant to repair, and the button
 * acts on what is on screen.
 */
export function ReprocessUnprocessedButton({ table, onChange }: Props): ReactElement | null {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { batchReprocessDocumentsOcr, fetching } = useReprocessDocumentOcr();

  // Read off the table rather than the query result: the screen's rows are still masked fragments
  // until `useDocumentsTable` unmasks them.
  const candidates = table
    .getRowModel()
    .rows.map(row => row.original)
    .filter(document => document.documentType === DocumentType.Unprocessed)
    .filter(document => document.file || document.image);

  if (candidates.length === 0) {
    return null;
  }

  const batch = candidates.slice(0, MAX_BATCH);
  const remaining = candidates.length - batch.length;

  function onReprocess(): void {
    batchReprocessDocumentsOcr(batch.map(document => document.id)).then(results => {
      if (results) {
        onChange();
      }
    });
  }

  return (
    <ConfirmationModal
      onConfirm={onReprocess}
      title={`Re-run OCR for ${batch.length} unprocessed ${batch.length === 1 ? 'document' : 'documents'}?`}
      open={confirmOpen}
      setOpen={setConfirmOpen}
    >
      <Button variant="outline" disabled={fetching}>
        <ScanText className="size-4" />
        Re-run OCR ({batch.length}
        {remaining > 0 ? `, ${remaining} more` : ''})
      </Button>
    </ConfirmationModal>
  );
}
