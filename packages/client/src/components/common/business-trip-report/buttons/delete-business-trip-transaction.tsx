import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteBusinessTripTransaction } from '../../../../hooks/use-delete-business-trip-transaction.js';
import { ConfirmationModal } from '../../modals/confirmation-modal.jsx';

export function DeleteBusinessTripTransaction(props: {
  businessTripTransactionId: string;
  onDelete?: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);

  const { fetching, deleteBusinessTripTransaction } = useDeleteBusinessTripTransaction();

  const onExecute = useCallback(() => {
    deleteBusinessTripTransaction({
      businessTripTransactionId: props.businessTripTransactionId,
    }).then(() => {
      props.onDelete?.();
      close();
    });
  }, [props, deleteBusinessTripTransaction, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onExecute}
        title="Are you sure you want to remove transaction?"
      />
      <Tooltip label="Remove Transaction">
        <ActionIcon variant="default" loading={fetching} size={30} onClick={open}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
