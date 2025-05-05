import { ReactElement, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, Overlay, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripOtherExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripOtherExpense } from '../../../../hooks/use-add-business-trip-other-expense.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import { Switch } from '../../../ui/switch.js';
import { AddExpenseFields } from './add-expense-fields.js';

export function AddOtherExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Other Expense">
        <ActionIcon
          variant="default"
          onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
            event.stopPropagation();
            open();
          }}
          size={30}
        >
          <Plus size={20} />
        </ActionIcon>
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
  const form = useForm<AddBusinessTripOtherExpenseInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = form;
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripOtherExpense, fetching: addingInProcess } =
    useAddBusinessTripOtherExpense();

  const onSubmit: SubmitHandler<AddBusinessTripOtherExpenseInput> = data => {
    addBusinessTripOtherExpense({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Other Expense</Modal.Title>
      <Modal.Body>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <AddExpenseFields
              businessTripId={businessTripId}
              control={control}
              setFetching={setFetching}
            />

            <FormField
              name="description"
              control={control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deductibleExpense"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Deductible Expense</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                  </FormControl>
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
