import { ReactElement, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { Loader, Modal, Overlay, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripAccommodationsExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripAccommodationsExpense } from '../../../../hooks/use-add-business-trip-accommodations-expense.js';
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
import { NumberInput } from '../../index.js';
import { AttendeesStayInput } from '../parts/attendee-stay-input.js';
import { AddExpenseFields } from './add-expense-fields.js';

export function AddAccommodationExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Accommodations Expense">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={event => {
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
  const formManager = useForm<AddBusinessTripAccommodationsExpenseInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = formManager;
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripAccommodationsExpense, fetching: addingInProcess } =
    useAddBusinessTripAccommodationsExpense();

  const onSubmit: SubmitHandler<AddBusinessTripAccommodationsExpenseInput> = data => {
    addBusinessTripAccommodationsExpense({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Accommodation Expense</Modal.Title>
      <Modal.Body>
        <Form {...formManager}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <AddExpenseFields
              businessTripId={businessTripId}
              control={control}
              setFetching={setFetching}
            />

            {/* TODO: replace with country select */}
            <FormField
              control={control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="nightsCount"
              control={control}
              render={({ field }): ReactElement => (
                <FormItem>
                  <FormLabel>Nights Count</FormLabel>
                  <FormControl>
                    <NumberInput
                      {...field}
                      value={field.value ?? undefined}
                      hideControls
                      decimalScale={0}
                      thousandSeparator=","
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AttendeesStayInput
              formManager={formManager}
              attendeesStayPath="attendeesStay"
              businessTripId={businessTripId}
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
