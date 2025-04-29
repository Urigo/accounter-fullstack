import { ReactElement } from 'react';
import { PlugConnectedX } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { EMPTY_UUID } from '../../../helpers/index.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  transactionId: string;
}

export function UnlinkTransactionButton({ transactionId }: Props): ReactElement {
  const { updateTransaction } = useUpdateTransaction();

  function onUnlink(): void {
    updateTransaction({
      transactionId,
      fields: { chargeId: EMPTY_UUID },
    });
  }

  return (
    <ConfirmationModal
      onConfirm={onUnlink}
      title="Are you sure you want to unlink this transaction from the charge?"
    >
      <ActionIcon>
        <PlugConnectedX size={20} />
      </ActionIcon>
    </ConfirmationModal>
  );
}
