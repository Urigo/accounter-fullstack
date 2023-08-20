import { ReactElement, useState } from 'react';
import { PlugConnectedX } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { ConfirmationModal } from '..';
import { useUpdateDocument } from '../../../hooks/use-update-document';

interface Props {
  documentId: string;
}

export function UnlinkDocumentButton({ documentId }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { updateDocument } = useUpdateDocument();

  function onUnlink(): void {
    updateDocument({
      documentId,
      fields: { chargeId: 'NULL' },
    });
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        onConfirm={onUnlink}
        title="Are you sure you want to unlink this document from the charge?"
      />
      <ActionIcon onClick={(): void => setOpened(true)}>
        <PlugConnectedX size={20} />
      </ActionIcon>
    </>
  );
}
