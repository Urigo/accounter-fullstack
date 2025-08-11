import { useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Loader, Modal, Overlay, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { AddBusinessTripTravelAndSubsistenceExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripTravelAndSubsistenceExpense } from '../../../../hooks/use-add-business-trip-travel-and-subsistence-expense.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import { AddExpenseFields } from './add-expense-fields.jsx';

export function AddTravelAndSubsistenceExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add T&S Expense">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(event): void => {
            event.stopPropagation();
            open();
          }}
        >
          <Plus className="size-5" />
        </Button>
      </Tooltip>
      {opened && (
        <ModalContent businessTripId={businessTripId} opened={opened} close={close} onAdd={onAdd} />
      )}
    </>
  );
}

type ModalProps = {
  opened: boolean;
  close: () => void;
  onAdd?: () => void;
  businessTripId: string;
};

function ModalContent({ businessTripId, opened, close, onAdd }: ModalProps): ReactElement {
  const form = useForm<AddBusinessTripTravelAndSubsistenceExpenseInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = form;
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripTravelAndSubsistenceExpense, fetching: addingInProcess } =
    useAddBusinessTripTravelAndSubsistenceExpense();

  const onSubmit: SubmitHandler<AddBusinessTripTravelAndSubsistenceExpenseInput> = data => {
    addBusinessTripTravelAndSubsistenceExpense({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Travel & Subsistence Expense</Modal.Title>
      <Modal.Body>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <AddExpenseFields
              businessTripId={businessTripId}
              control={control}
              setFetching={setFetching}
            />

            <FormField
              name="expenseType"
              control={control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Type</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-center mt-5 gap-3">
              <button
                type="submit"
                className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
              >
                Add
              </button>
            </div>
          </form>
        </Form>
      </Modal.Body>
      {(addingInProcess || fetching) && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
