import { ReactElement } from 'react';
import { WorldUpload } from 'tabler-icons-react';
import { Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ActionIcon } from '../../ui/action-icon.js';
import { InsertBusinessTrip } from '../index.js';

interface Props {
  onDone?: () => void;
}

export const InsertBusinessTripModal = ({ onDone }: Props): ReactElement => {
  const [opened, { open, close }] = useDisclosure(false);

  function onInsertDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip label="Add New Business Trip">
        <ActionIcon onClick={open}>
          <WorldUpload size={20} />
        </ActionIcon>
      </Tooltip>
      <Modal centered opened={opened} onClose={close} title="Add Business Trip">
        <InsertBusinessTrip onDone={onInsertDone} />
      </Modal>
    </>
  );
};
