import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { Loader, Modal, NumberInput, Overlay, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripCarRentalExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripCarRentalExpense } from '../../../../hooks/use-add-business-trip-car-rental-expense.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Switch } from '../../../ui/switch.js';
import { AddExpenseFields } from './add-expense-fields.jsx';

export function AddCarRentalExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Car Rental Expense">
        <Button
          variant="outline"
          size="icon"
          onClick={event => {
            event.stopPropagation();
            open();
          }}
          className="size-7.5"
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
  const form = useForm<AddBusinessTripCarRentalExpenseInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = form;
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripCarRentalExpense, fetching: addingInProcess } =
    useAddBusinessTripCarRentalExpense();

  const onSubmit: SubmitHandler<AddBusinessTripCarRentalExpenseInput> = data => {
    addBusinessTripCarRentalExpense({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Car Rental Expense</Modal.Title>
      <Modal.Body>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <AddExpenseFields
              businessTripId={businessTripId}
              control={control}
              setFetching={setFetching}
            />

            <Controller
              name="days"
              control={control}
              render={({ field, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  value={field.value ?? undefined}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  error={fieldState.error?.message}
                  label="Rent Days"
                />
              )}
            />

            <FormField
              name="isFuelExpense"
              control={control}
              render={({ field: { value, ...field } }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Is Fuel Expense</FormLabel>
                  </div>
                  <FormControl>
                    <Switch {...field} checked={value === true} onCheckedChange={field.onChange} />
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
