import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteDeprecationRecord } from '../../../hooks/use-delete-deprecation-record.js';
import { ConfirmationModal } from '../modals/confirmation-modal.js';

export function DeleteDeprecationRecord(props: {
  deprecationRecordId: string;
  onDelete?: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);

  const { fetching, deleteDeprecationRecord } = useDeleteDeprecationRecord();

  const onExecute = useCallback(() => {
    deleteDeprecationRecord({
      deprecationRecordId: props.deprecationRecordId,
    }).then(() => {
      props.onDelete?.();
      close();
    });
  }, [props, deleteDeprecationRecord, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onExecute}
        title="Are you sure you want to delete the deprecation record?"
      />
      <Tooltip label="Remove Deprecation">
        <ActionIcon variant="default" loading={fetching} size={30} onClick={open}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
