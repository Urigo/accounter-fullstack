import { useContext, useState, type ReactElement } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { UserContext } from '@/providers/user-provider.js';
import type { InsertNewBusinessInput } from '../../../gql/graphql.js';
import { useInsertBusiness } from '../../../hooks/use-insert-business.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { Form } from '../../ui/form.js';
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
  const { userContext } = useContext(UserContext);
  const formManager = useForm<InsertNewBusinessInput>({
    defaultValues: {
      name: description,
      country: userContext?.context.locality || 'ISR',
      suggestions: { phrases: [description] },
    },
  });
  const { handleSubmit } = formManager;
  const [fetching, setFetching] = useState(false);

  const { insertBusiness, fetching: addingInProcess } = useInsertBusiness();

  const onSubmit: SubmitHandler<InsertNewBusinessInput> = data => {
    data.sortCode &&= parseInt(data.sortCode.toString());
    insertBusiness({ fields: data }).then(res => {
      if (res?.id) {
        onAdd?.(res.id);
        close();
      }
    });
  };

  return (
    <Form {...formManager}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <InsertBusinessFields formManager={formManager} setFetching={setFetching} />

        <div className="flex justify-center mt-4">
          <Button type="submit" disabled={addingInProcess || fetching}>
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
}
