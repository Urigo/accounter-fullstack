import { ReactElement } from 'react';
import { PlugConnectedX } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { EMPTY_UUID } from '../../../helpers/index.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  documentId: string;
}

export function UnlinkDocumentButton({ documentId }: Props): ReactElement {
  const { updateDocument } = useUpdateDocument();

  function onUnlink(): void {
    updateDocument({
      documentId,
      fields: { chargeId: EMPTY_UUID },
    });
  }

  return (
    <ConfirmationModal
      onConfirm={onUnlink}
      title="Are you sure you want to unlink this document from the charge?"
    >
      <ActionIcon>
        <PlugConnectedX size={20} />
      </ActionIcon>
    </ConfirmationModal>
  );
}
