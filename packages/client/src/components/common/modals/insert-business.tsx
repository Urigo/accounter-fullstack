import { ReactElement, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { InsertNewBusinessInput } from '../../../gql/graphql.js';
import { useInsertBusiness } from '../../../hooks/use-insert-business.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { InsertBusinessFields } from '../index.js';

export function InsertBusiness({
  description,
  onAdd,
}: {
  description: string;
  onAdd?: (businessId: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Business</Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Add New Business</DialogTitle>
        </DialogHeader>
        <CreateBusinessForm description={description} close={() => setOpen(false)} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

type CreateBusinessFormProps = {
  close: () => void;
  onAdd?: (businessId: string) => void;
  description: string;
};

function CreateBusinessForm({ description, close, onAdd }: CreateBusinessFormProps): ReactElement {
  const useFormManager = useForm<InsertNewBusinessInput>({
    defaultValues: {
      name: description,
      country: 'Israel',
      suggestions: { phrases: [description] },
    },
  });
  const { handleSubmit } = useFormManager;
  const [fetching, setFetching] = useState(false);

  const { insertBusiness, fetching: addingInProcess } = useInsertBusiness();

  const onSubmit: SubmitHandler<InsertNewBusinessInput> = data => {
    data.sortCode &&= parseInt(data.sortCode.toString());
    insertBusiness({ fields: data }).then(({ id }) => {
      onAdd?.(id);
      close();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <InsertBusinessFields useFormManager={useFormManager} setFetching={setFetching} />

      <div className="flex justify-center mt-4">
        <Button type="submit" disabled={addingInProcess || fetching}>
          Add
        </Button>
      </div>
    </form>
  );
}
