import { ReactElement } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { useDeleteDocument } from '../../../hooks/use-delete-document.js';
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
      <ActionIcon color="red">
        <Trash size={20} />
      </ActionIcon>
    </ConfirmationModal>
  );
}
