import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, NumberInput, Overlay, TextInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripAccommodationsExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripAccommodationsExpense } from '../../../../hooks/use-add-business-trip-accommodations-expense.js';
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
        <ActionIcon
          variant="default"
          onClick={(event): void => {
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <AddExpenseFields
            businessTripId={businessTripId}
            control={control}
            setFetching={setFetching}
          />

          <Controller
            name="country"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <TextInput
                {...field}
                value={field.value ?? undefined}
                error={fieldState.error?.message}
                label="Country"
              />
            )}
          />
          <Controller
            name="nightsCount"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <NumberInput
                {...field}
                value={field.value ?? undefined}
                hideControls
                precision={2}
                removeTrailingZeros
                error={fieldState.error?.message}
                label="Nights Count"
              />
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
              className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            >
              Add
            </button>
          </div>
        </form>
      </Modal.Body>
      {(addingInProcess || fetching) && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
