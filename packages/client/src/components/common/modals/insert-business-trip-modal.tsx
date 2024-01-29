import { ReactElement } from 'react';
import { WorldUpload } from 'tabler-icons-react';
import { ActionIcon, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { InsertBusinessTrip } from '..';

interface Props {
  onDone?: () => void;
}

export const InsertBusinessTripModal = ({ onDone }: Props): ReactElement => {
  const [opened, { open, close }] = useDisclosure(false);

  function onInsertDone(): void {
    close();
    if (onDone) {
      onDone();
    }
  }
  return (
    <>
      <ActionIcon onClick={open}>
        <WorldUpload size={20} />
      </ActionIcon>
      <Modal centered opened={opened} onClose={close} title="Insert Business Trip">
        <InsertBusinessTrip onDone={onInsertDone} />
      </Modal>
    </>
  );
};
