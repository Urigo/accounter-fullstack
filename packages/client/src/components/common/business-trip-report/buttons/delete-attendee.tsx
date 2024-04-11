import { ReactElement, useCallback } from 'react';
import { Trash } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteBusinessTripAttendee } from '../../../../hooks/use-delete-business-trip-attendee.js';
import { ConfirmationModal } from '../../modals/confirmation-modal.js';

export function DeleteAttendee(props: {
  businessTripId: string;
  attendeeId: string;
  onDelete?: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);

  const { fetching, deleteBusinessTripAttendee } = useDeleteBusinessTripAttendee();

  const onExecute = useCallback(() => {
    deleteBusinessTripAttendee({
      fields: {
        businessTripId: props.businessTripId,
        attendeeId: props.attendeeId,
      },
    }).then(() => {
      props.onDelete?.();
      close();
    });
  }, [props, deleteBusinessTripAttendee, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onExecute}
        title="Are you sure you want to remove attendee?"
      />
      <Tooltip label="Remove Attendee">
        <ActionIcon variant="default" loading={fetching} size={30} onClick={open}>
          <Trash size={20} color="red" />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
