import { useState, type ReactElement } from 'react';
import { useForm, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import type { AddSortCodeMutationVariables } from '../../../gql/graphql.js';
import { useAddSortCode } from '../../../hooks/use-add-sort-code.js';
import { Button } from '../../ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.jsx';
import { Form } from '../../ui/form.jsx';
import { ModifySortCodeFields } from '../forms/index.js';
import type { EditSortCodeVariables } from './edit-sort-code.js';

export function InsertSortCode({ onAdd }: { onAdd?: () => void }): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Sort Code</Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Add New Sort Code</DialogTitle>
        </DialogHeader>
        <CreateSortCodeForm close={() => setOpen(false)} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

type CreateSortCodeFormProps = {
  close: () => void;
  onAdd?: () => void;
};

function CreateSortCodeForm({ close, onAdd }: CreateSortCodeFormProps): ReactElement {
  const formManager = useForm<AddSortCodeMutationVariables>({});
  const { handleSubmit } = formManager;

  const { addSortCode, fetching: addingInProcess } = useAddSortCode();

  const onSubmit: SubmitHandler<AddSortCodeMutationVariables> = data => {
    data.key &&= parseInt(data.key.toString());
    data.defaultIrsCode &&= parseInt(data.defaultIrsCode.toString());
    addSortCode(data).then(() => {
      close();
      onAdd?.();
    });
  };

  return (
    <Form {...formManager}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4 my-4">
          <ModifySortCodeFields
            isInsert
            formManager={
              formManager as UseFormReturn<EditSortCodeVariables, unknown, EditSortCodeVariables>
            }
          />
        </div>

        <div className="flex justify-end mt-4">
          <Button type="submit" disabled={addingInProcess}>
            Add Sort Code
          </Button>
        </div>
      </form>
    </Form>
  );
}
