import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, Overlay, TextInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripTravelAndSubsistenceExpenseInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripTravelAndSubsistenceExpense } from '../../../../hooks/use-add-business-trip-travel-and-subsistence-expense.js';
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
  const { control, handleSubmit } = useForm<AddBusinessTripTravelAndSubsistenceExpenseInput>({
    defaultValues: { businessTripId },
  });
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <AddExpenseFields
            businessTripId={businessTripId}
            control={control}
            setFetching={setFetching}
          />

          <Controller
            name="expenseType"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <TextInput
                {...field}
                value={field.value ?? undefined}
                error={fieldState.error?.message}
                label="Expense Type"
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
