import { ReactElement } from 'react';
import { PlaylistAdd } from 'tabler-icons-react';
import { ActionIcon, Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { InsertMiscExpense } from '../index.js';

interface Props {
  transactionId: string;
  onDone?: () => void;
}

export const InsertMiscExpenseModal = ({ onDone, transactionId }: Props): ReactElement => {
  const [opened, { open, close }] = useDisclosure(false);

  function onInsertDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip label="Insert Related Misc Expense">
        <ActionIcon onClick={open}>
          <PlaylistAdd size={20} />
        </ActionIcon>
      </Tooltip>
      <Modal centered opened={opened} onClose={close} title="Insert Misc Expense">
        <InsertMiscExpense onDone={onInsertDone} transactionId={transactionId} />
      </Modal>
    </>
  );
};
