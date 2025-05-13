import { ReactElement, useState } from 'react';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { EditMiscExpenseFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType } from '../../../gql/index.js';
import { Dialog, DialogContent, DialogTrigger } from '../../ui/dialog.js';
import { EditMiscExpense } from '../index.js';

interface Props {
  data: FragmentType<typeof EditMiscExpenseFieldsFragmentDoc>;
  onDone?: () => void;
}

export const EditMiscExpenseModal = ({ onDone, data }: Props): ReactElement => {
  const [dialogOpen, setDialogOpen] = useState(false);

  function onEditDone(): void {
    setDialogOpen(false);
    onDone?.();
  }
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild onClick={() => setDialogOpen(true)}>
        <Tooltip label="Edit Misc Expense">
          <ActionIcon>
            <Edit size={20} />
          </ActionIcon>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <EditMiscExpense onDone={onEditDone} data={data} />
      </DialogContent>
    </Dialog>
  );
};
