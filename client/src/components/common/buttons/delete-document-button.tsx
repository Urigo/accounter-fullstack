import { useState } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { ConfirmationModal } from '..';
import { useDeleteDocument } from '../../../hooks/use-delete-document';

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
    setOpened(false);
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
