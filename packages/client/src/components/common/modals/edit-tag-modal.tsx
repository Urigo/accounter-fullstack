import { useState, type ReactElement } from 'react';
import { Edit } from 'lucide-react';
import { EditTagFieldsFragmentDoc } from '../../../gql/graphql.js';
import type { FragmentType } from '../../../gql/index.js';
import { Button } from '../../ui/button.js';
import { EditTag, Tooltip } from '../index.js';
import { PopUpModal } from './modal.js';

interface Props {
  data: FragmentType<typeof EditTagFieldsFragmentDoc>;
  onDone?: () => void;
}

export const EditTagModal = ({ onDone, data }: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const close = (): void => setOpened(false);

  function onEditDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip content="Edit Tag">
        <Button variant="ghost" size="icon" className="size-7.5" onClick={() => setOpened(true)}>
          <Edit className="size-5" />
        </Button>
      </Tooltip>
      <PopUpModal opened={opened} onClose={close} title="Insert Business Trip" withCloseButton>
        <EditTag close={close} onDone={onEditDone} data={data} />
      </PopUpModal>
    </>
  );
};
