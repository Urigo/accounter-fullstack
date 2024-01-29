import { ReactElement, useState } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { ConfirmationModal } from '..';
import { useDeleteDocument } from '../../../hooks/use-delete-document';

interface Props {
  documentId: string;
}

export function DeleteDocumentButton({ documentId }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { deleteDocument } = useDeleteDocument();

  function onDelete(): void {
    deleteDocument({
      documentId,
    });
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this document?"
      />
      <ActionIcon color="red" onClick={(): void => setOpened(true)}>
        <Trash size={20} />
      </ActionIcon>
    </>
  );
}
