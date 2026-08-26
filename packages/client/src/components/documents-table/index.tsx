import type { ReactElement } from 'react';
import type { TableDocumentsRowFieldsFragmentDoc } from '../../gql/graphql.js';
import type { FragmentType } from '../../gql/index.js';
import { EditDocumentModal } from '../common/index.js';
import { DocumentsDataTable } from './data-table.js';
import { useDocumentsTable } from './use-documents-table.js';

type Props = {
  documentsProps: FragmentType<typeof TableDocumentsRowFieldsFragmentDoc>[];
  onChange?: () => void;
  /** Called when removing a document emptied its charge and the server deleted the charge too. */
  onChargeDeleted?: (chargeId: string) => void;
  /** Restrict the table to these column ids. Defaults to the full shared column set. */
  columnIds?: string[];
  /** Include the actions-menu items that navigate to the document's charge. */
  withChargeLink?: boolean;
};

export const DocumentsTable = ({
  documentsProps,
  onChange,
  onChargeDeleted,
  columnIds,
  withChargeLink,
}: Props): ReactElement => {
  const { table, editDocumentId, closeEditDocument } = useDocumentsTable({
    documentsProps,
    onChange,
    columnIds,
    withChargeLink,
  });

  return (
    <>
      <DocumentsDataTable table={table} />
      <EditDocumentModal
        documentId={editDocumentId}
        onDone={closeEditDocument}
        onChange={() => onChange?.()}
        onChargeDeleted={onChargeDeleted}
      />
    </>
  );
};

export { DocumentsDataTable } from './data-table.js';
export { DocumentActionsMenu } from './document-actions-menu.js';
export { useDocumentsTable } from './use-documents-table.js';
