import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, NumberInput, Overlay, TextInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AddBusinessTripAccommodationsTransactionInput } from '../../../../gql/graphql.js';
import { useAddBusinessTripAccommodationsTransaction } from '../../../../hooks/use-add-business-trip-accommodations-transaction.js';
import { AddTransactionFields } from './add-transaction-fields.jsx';

export function AddAccommodationTransaction(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Accommodations Transaction">
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
  const { control, handleSubmit } = useForm<AddBusinessTripAccommodationsTransactionInput>({
    defaultValues: { businessTripId },
  });
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripAccommodationsTransaction, fetching: addingInProcess } =
    useAddBusinessTripAccommodationsTransaction();

  const onSubmit: SubmitHandler<AddBusinessTripAccommodationsTransactionInput> = data => {
    addBusinessTripAccommodationsTransaction({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Accommodation Transaction</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <AddTransactionFields
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
