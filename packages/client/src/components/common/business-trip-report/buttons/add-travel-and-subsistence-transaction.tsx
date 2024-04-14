import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, Overlay, TextInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripTravelAndSubsistenceTransactionInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripTravelAndSubsistenceTransaction } from '../../../../hooks/use-add-business-trip-travel-and-subsistence-transaction.js';
import { AddTransactionFields } from './add-transaction-fields.jsx';

export function AddTravelAndSubsistenceTransaction(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add T&S Transaction">
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
  const { control, handleSubmit } = useForm<AddBusinessTripTravelAndSubsistenceTransactionInput>({
    defaultValues: { businessTripId },
  });
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripTravelAndSubsistenceTransaction, fetching: addingInProcess } =
    useAddBusinessTripTravelAndSubsistenceTransaction();

  const onSubmit: SubmitHandler<AddBusinessTripTravelAndSubsistenceTransactionInput> = data => {
    addBusinessTripTravelAndSubsistenceTransaction({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Travel & Subsistence Transaction</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <AddTransactionFields
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
