import { ReactElement } from 'react';
import { Trash } from 'tabler-icons-react';
import { useDeleteDocument } from '../../../hooks/use-delete-document.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  documentId: string;
}

export function DeleteDocumentButton({ documentId }: Props): ReactElement {
  const { deleteDocument } = useDeleteDocument();

  function onDelete(): void {
    deleteDocument({
      documentId,
    });
  }

  return (
    <ConfirmationModal onConfirm={onDelete} title="Are you sure you want to delete this document?">
      <Button variant="ghost" size="icon" className="size-7.5 text-red-500">
        <Trash className="size-5" />
      </Button>
    </ConfirmationModal>
  );
}
