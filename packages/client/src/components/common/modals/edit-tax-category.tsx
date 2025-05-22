import { ReactElement, useState } from 'react';
import { Edit } from 'lucide-react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2 } from 'tabler-icons-react';
import { useQuery } from 'urql';
import {
  TaxCategoryToUpdateDocument,
  TaxCategoryToUpdateQuery,
  UpdateTaxCategoryInput,
} from '../../../gql/graphql.js';
import { useUpdateTaxCategory } from '../../../hooks/use-update-tax-category.js';
import { Button } from '../../ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.jsx';
import { Form } from '../../ui/form.js';
import { ModifyTaxCategoryFields } from '../forms/modify-tax-category-fields.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query TaxCategoryToUpdate($id: UUID!) {
    taxCategory(id: $id) {
      id
      name
      sortCode {
        id
        key
        name
      }
    }
  }
`;

export function EditTaxCategory({
  taxCategoryId,
  onAdd,
}: {
  taxCategoryId: string;
  onAdd?: (taxCategoryId: string) => void;
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
          <DialogTitle>Edit Tax Category</DialogTitle>
        </DialogHeader>
        <ModalContent taxCategoryId={taxCategoryId} close={() => setOpen(false)} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

type ModalContentProps = {
  close: () => void;
  onAdd?: (taxCategoryId: string) => void;
  taxCategoryId: string;
};

function ModalContent({ taxCategoryId, close, onAdd }: ModalContentProps): ReactElement {
  const [{ data, fetching }] = useQuery({
    query: TaxCategoryToUpdateDocument,
    variables: {
      id: taxCategoryId,
    },
  });

  const taxCategory = data?.taxCategory;

  if (!taxCategory && !fetching) {
    toast.error('Error', {
      description: "Couldn'nt find tax category",
    });
  }

  return fetching ? (
    <Loader2 className="h-10 w-10 animate-spin" />
  ) : (
    <EditTaxCategoryForm taxCategory={taxCategory!} close={close} onAdd={onAdd} />
  );
}

type EditTaxCategoryFormProps = {
  close: () => void;
  onAdd?: (taxCategoryId: string) => void;
  taxCategory: TaxCategoryToUpdateQuery['taxCategory'];
};

function EditTaxCategoryForm({
  taxCategory,
  close,
  onAdd,
}: EditTaxCategoryFormProps): ReactElement {
  const useFormManager = useForm<UpdateTaxCategoryInput>({
    defaultValues: {
      sortCode: taxCategory.sortCode?.key,
      name: taxCategory.name,
    },
  });
  const { handleSubmit } = useFormManager;
  const [fetching, setFetching] = useState(false);

  const { updateTaxCategory, fetching: updatingInProcess } = useUpdateTaxCategory();

  const onSubmit: SubmitHandler<UpdateTaxCategoryInput> = data => {
    data.sortCode &&= parseInt(data.sortCode.toString());
    updateTaxCategory({ fields: data, taxCategoryId: taxCategory.id }).then(res => {
      if (res?.id) {
        onAdd?.(res.id);
        close();
      }
    });
  };

  return (
    <Form {...useFormManager}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4 my-4">
          <ModifyTaxCategoryFields
            isInsert={false}
            formManager={useFormManager}
            setFetching={setFetching}
          />
        </div>

        <div className="flex justify-end mt-4">
          <Button type="submit" disabled={updatingInProcess || fetching}>
            Update
          </Button>
        </div>
      </form>
    </Form>
  );
}
