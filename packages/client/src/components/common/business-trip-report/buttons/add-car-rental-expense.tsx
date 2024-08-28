import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, NumberInput, Overlay, Switch, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripCarRentalExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripCarRentalExpense } from '../../../../hooks/use-add-business-trip-car-rental-expense.js';
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
  const { control, handleSubmit } = useForm<AddBusinessTripCarRentalExpenseInput>({
    defaultValues: { businessTripId },
  });
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
          <Controller
            name="isFuelExpense"
            control={control}
            defaultValue={false}
            render={({ field: { value, ...field }, fieldState }): ReactElement => (
              <Switch
                {...field}
                checked={value === true}
                error={fieldState.error?.message}
                label="Is Fuel Expense"
              />
            )}
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
