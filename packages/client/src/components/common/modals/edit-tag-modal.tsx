import { ReactElement } from 'react';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { EditTagFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType } from '../../../gql/index.js';
import { EditTag } from '../index.js';

interface Props {
  data: FragmentType<typeof EditTagFieldsFragmentDoc>;
  onDone?: () => void;
}

export const EditTagModal = ({ onDone, data }: Props): ReactElement => {
  const [opened, { open, close }] = useDisclosure(false);

  function onEditDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip label="Edit Tag">
        <ActionIcon onClick={open}>
          <Edit size={20} />
        </ActionIcon>
      </Tooltip>
      <Modal centered opened={opened} onClose={close} title="Insert Business Trip">
        <EditTag close={close} onDone={onEditDone} data={data} />
      </Modal>
    </>
  );
};
