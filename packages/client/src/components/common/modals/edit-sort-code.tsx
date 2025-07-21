import { ReactElement, useState } from 'react';
import { Edit, Loader2 } from 'lucide-react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  AddSortCodeMutationVariables,
  SortCodeToUpdateDocument,
  SortCodeToUpdateQuery,
} from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker } from '../../../helpers/index.js';
import { useUpdateSortCode } from '../../../hooks/use-update-sort-code.js';
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

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SortCodeToUpdate($key: Int!) {
    sortCode(key: $key) {
      id
      key
      name
      defaultIrsCode
    }
  }
`;

export function EditSortCode({
  sortCodeKey,
  onAdd,
}: {
  sortCodeKey: number;
  onAdd?: (sortCodeKey: number) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Edit />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[400px] max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Edit Sort Code</DialogTitle>
        </DialogHeader>
        <ModalContent sortCodeKey={sortCodeKey} close={() => setOpen(false)} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

type ModalContentProps = {
  close: () => void;
  onAdd?: (sortCodeKey: number) => void;
  sortCodeKey: number;
};

function ModalContent({ sortCodeKey, close, onAdd }: ModalContentProps): ReactElement {
  const [{ data, fetching }] = useQuery({
    query: SortCodeToUpdateDocument,
    variables: {
      key: sortCodeKey,
    },
  });

  const sortCode = data?.sortCode;

  if (!sortCode && !fetching) {
    toast.error('Error', {
      description: "Couldn't find sort code",
    });
  }

  return fetching ? (
    <Loader2 className="h-10 w-10 animate-spin" />
  ) : sortCode ? (
    <EditSortCodeForm sortCode={sortCode} close={close} onAdd={onAdd} />
  ) : (
    <div>Sort code not found</div>
  );
}

export type EditSortCodeVariables = Partial<Omit<AddSortCodeMutationVariables, 'key'>> &
  Pick<AddSortCodeMutationVariables, 'key'>;

type EditSortCodeFormProps = {
  close: () => void;
  onAdd?: (sortCodeKey: number) => void;
  sortCode: NonNullable<SortCodeToUpdateQuery['sortCode']>;
};

function EditSortCodeForm({ sortCode, close, onAdd }: EditSortCodeFormProps): ReactElement {
  const useFormManager = useForm<EditSortCodeVariables>({
    defaultValues: sortCode as EditSortCodeVariables,
  });
  const {
    handleSubmit,
    formState: { dirtyFields: dirtyBusinessFields },
  } = useFormManager;

  const { updateSortCode, fetching: updatingInProcess } = useUpdateSortCode();

  const onSubmit: SubmitHandler<EditSortCodeVariables> = ({ key: _, ...fields }) => {
    const dataToUpdate = relevantDataPicker(
      fields,
      dirtyBusinessFields as MakeBoolean<typeof fields>,
    );
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      let defaultIrsCode: number | undefined = undefined;
      if (dataToUpdate.defaultIrsCode) {
        const code = dataToUpdate.defaultIrsCode;
        const parsed = Number(code);
        if (!Number.isInteger(parsed) || parsed < 2 || parsed > 9999) {
          throw new Error(`Invalid IRS code: ${code}`);
        }
        defaultIrsCode = parsed;
      }
      updateSortCode({
        fields: { ...dataToUpdate, defaultIrsCode },
        key: sortCode.key,
      }).then(res => {
        if (res) {
          onAdd?.(sortCode.key);
          close();
        }
      });
    }
  };

  return (
    <Form {...useFormManager}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4 my-4">
          <ModifySortCodeFields isInsert={false} formManager={useFormManager} />
        </div>

        <div className="flex justify-end mt-4">
          <Button type="submit" disabled={updatingInProcess}>
            Update
          </Button>
        </div>
      </form>
    </Form>
  );
}
