import { ActionIcon } from '@mantine/core';
import { useState } from 'react';
import { PlugConnectedX } from 'tabler-icons-react';

import { useUpdateDocument } from '../../../hooks/use-update-document';
import { ConfirmationModal } from '../../common';

interface Props {
  documentId: string;
}

export function UnlinkDocumentButton({ documentId }: Props) {
  const [opened, setOpened] = useState(false);
  const { mutate } = useUpdateDocument();

  function onUnlink() {
    mutate({
      documentId,
      fields: { chargeId: null },
    });
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={() => setOpened(false)}
        onConfirm={onUnlink}
        title="Are you sure you want to unlink this document from the charge?"
      />
      <ActionIcon variant="hover" onClick={() => setOpened(true)}>
        <PlugConnectedX size={20} />
      </ActionIcon>
    </>
  );
}
