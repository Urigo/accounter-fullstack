import { ReactElement, useState } from 'react';
import { SubmitHandler, useForm, UseFormReturn } from 'react-hook-form';
import { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { useInsertTaxCategory } from '../../../hooks/use-insert-tax-category.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { ModifyTaxCategoryFields } from '../forms/modify-tax-category-fields.js';

export function InsertTaxCategory({
  onAdd,
}: {
  onAdd?: (taxCategoryId: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Tax Category</Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Add New Tax Category</DialogTitle>
        </DialogHeader>
        <CreateTaxCategoryForm close={() => setOpen(false)} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

type CreateTaxCategoryFormProps = {
  close: () => void;
  onAdd?: (taxCategoryId: string) => void;
};

function CreateTaxCategoryForm({ close, onAdd }: CreateTaxCategoryFormProps): ReactElement {
  const useFormManager = useForm<InsertTaxCategoryInput>({});
  const { handleSubmit } = useFormManager;
  const [fetching, setFetching] = useState(false);

  const { insertTaxCategory, fetching: addingInProcess } = useInsertTaxCategory();

  const onSubmit: SubmitHandler<InsertTaxCategoryInput> = data => {
    data.sortCode &&= parseInt(data.sortCode.toString());
    insertTaxCategory({ fields: data }).then(res => {
      if (res?.id) {
        onAdd?.(res.id);
        close();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-4 my-4">
        <ModifyTaxCategoryFields
          isInsert
          useFormManager={
            useFormManager as UseFormReturn<UpdateTaxCategoryInput, unknown, UpdateTaxCategoryInput>
          }
          setFetching={setFetching}
        />
      </div>

      <div className="flex justify-end mt-4">
        <Button type="submit" disabled={addingInProcess || fetching}>
          Add Tax Category
        </Button>
      </div>
    </form>
  );
}
