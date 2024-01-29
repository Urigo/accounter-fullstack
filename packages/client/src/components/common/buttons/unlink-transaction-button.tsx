import { ReactElement, useState } from 'react';
import { PlugConnectedX } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { ConfirmationModal } from '..';
import { EMPTY_UUID } from '../../../helpers';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction';

interface Props {
  transactionId: string;
}

export function UnlinkTransactionButton({ transactionId }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { updateTransaction } = useUpdateTransaction();

  function onUnlink(): void {
    updateTransaction({
      transactionId,
      fields: { chargeId: EMPTY_UUID },
    });
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        onConfirm={onUnlink}
        title="Are you sure you want to unlink this transaction from the charge?"
      />
      <ActionIcon onClick={(): void => setOpened(true)}>
        <PlugConnectedX size={20} />
      </ActionIcon>
    </>
  );
}
