import { ActionIcon } from '@mantine/core';
import { useState } from 'react';
import { Trash } from 'tabler-icons-react';

import { useDeleteDocument } from '../../../hooks/use-delete-document';
import { ConfirmationModal } from '../../common';

interface Props {
  documentId: string;
}

export function DeleteDocumentButton({ documentId }: Props) {
  const [opened, setOpened] = useState(false);
  const { mutate } = useDeleteDocument();

  function onDelete() {
    mutate({
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
      <ActionIcon color="red" variant="hover" onClick={() => setOpened(true)}>
        <Trash size={20} />
      </ActionIcon>
    </>
  );
}
