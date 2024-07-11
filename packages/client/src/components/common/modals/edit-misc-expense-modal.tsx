import { ReactElement } from 'react';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { EditMiscExpense } from '..';
import { EditMiscExpenseFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType } from '../../../gql/index.js';

interface Props {
  data: FragmentType<typeof EditMiscExpenseFieldsFragmentDoc>;
  onDone?: () => void;
}

export const EditMiscExpenseModal = ({ onDone, data }: Props): ReactElement => {
  const [opened, { open, close }] = useDisclosure(false);

  function onEditDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip label="Edit Misc Expense">
        <ActionIcon onClick={open}>
          <Edit size={20} />
        </ActionIcon>
      </Tooltip>
      <Modal centered opened={opened} onClose={close} title="Edit Misc Expense">
        <EditMiscExpense onDone={onEditDone} data={data} />
      </Modal>
    </>
  );
};
