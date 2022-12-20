import { useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { Trash } from 'tabler-icons-react';
import { useDeleteDocument } from '../../../hooks/use-delete-document';
import { ConfirmationModal } from '../../common';

interface Props {
  documentId: string;
}

export function DeleteDocumentButton({ documentId }: Props) {
  const [opened, setOpened] = useState(false);
  const { deleteDocument } = useDeleteDocument();

  function onDelete() {
    deleteDocument({
      documentId,
    });
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={() => setOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this document?"
      />
      <ActionIcon color="red" onClick={() => setOpened(true)}>
        <Trash size={20} />
      </ActionIcon>
    </>
  );
}
