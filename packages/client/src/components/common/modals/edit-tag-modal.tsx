import type { ReactElement } from 'react';
import { Edit } from 'lucide-react';
import { Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { EditTagFieldsFragmentDoc } from '../../../gql/graphql.js';
import type { FragmentType } from '../../../gql/index.js';
import { Button } from '../../ui/button.js';
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
        <Button variant="ghost" size="icon" className="size-7.5" onClick={open}>
          <Edit className="size-5" />
        </Button>
      </Tooltip>
      <Modal centered opened={opened} onClose={close} title="Insert Business Trip">
        <EditTag close={close} onDone={onEditDone} data={data} />
      </Modal>
    </>
  );
};
