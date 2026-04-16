import { useState, type ReactElement } from 'react';
import { MapPlus } from 'lucide-react';
import { Modal } from '@mantine/core';
import { Button } from '../../ui/button.js';
import { InsertBusinessTrip, Tooltip } from '../index.js';

interface Props {
  onDone?: () => void;
}

export const InsertBusinessTripModal = ({ onDone }: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const close = (): void => setOpened(false);

  function onInsertDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip content="Add New Business Trip">
        <Button variant="ghost" size="icon" className="size-7.5" onClick={() => setOpened(true)}>
          <MapPlus className="size-5" />
        </Button>
      </Tooltip>
      <Modal centered opened={opened} onClose={close} title="Add Business Trip">
        <InsertBusinessTrip onDone={onInsertDone} />
      </Modal>
    </>
  );
};
