import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, Overlay, Switch, TextInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripOtherTransactionInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripOtherTransaction } from '../../../../hooks/use-add-business-trip-other-transaction.js';
import { AddTransactionFields } from './add-transaction-fields.js';

export function AddOtherTransaction(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Other Transaction">
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
  const { control, handleSubmit } = useForm<AddBusinessTripOtherTransactionInput>({
    defaultValues: { businessTripId },
  });
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripOtherTransaction, fetching: addingInProcess } =
    useAddBusinessTripOtherTransaction();

  const onSubmit: SubmitHandler<AddBusinessTripOtherTransactionInput> = data => {
    addBusinessTripOtherTransaction({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Other Transaction</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <AddTransactionFields
            businessTripId={businessTripId}
            control={control}
            setFetching={setFetching}
          />

          <Controller
            name="description"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <TextInput
                {...field}
                value={field.value ?? undefined}
                error={fieldState.error?.message}
                label="Description"
              />
            )}
          />
          <Controller
            name="deductibleExpense"
            control={control}
            render={({ field: { value, ...field }, fieldState }): ReactElement => (
              <Switch
                {...field}
                checked={value === true}
                label="Deductible Expense"
                error={fieldState.error?.message}
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
