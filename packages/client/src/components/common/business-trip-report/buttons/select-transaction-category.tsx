import { ReactElement } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, Overlay, Select, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BusinessTripTransactionCategories,
  UpdateBusinessTripTransactionCategoryInput,
} from '../../../../gql/graphql.js';
import { useUpdateBusinessTripTransactionCategory } from '../../../../hooks/use-update-business-trip-transaction-category.js';

export function SelectTransactionCategory(props: {
  businessTripId: string;
  transactionId: string;
  onChange?: () => void;
}): ReactElement {
  const { businessTripId, transactionId, onChange } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Edit">
        <ActionIcon
          variant="default"
          onClick={(event): void => {
            event.stopPropagation();
            open();
          }}
          size={30}
        >
          <Edit size={20} />
        </ActionIcon>
      </Tooltip>
      {opened && (
        <ModalContent
          businessTripId={businessTripId}
          transactionId={transactionId}
          opened={opened}
          close={close}
          onChange={onChange}
        />
      )}
    </>
  );
}

const categories = Object.entries(BusinessTripTransactionCategories).map(([key, value]) => ({
  value,
  label: key,
}));

type ModalProps = {
  opened: boolean;
  close: () => void;
  onChange?: () => void;
  businessTripId: string;
  transactionId: string;
};

function ModalContent({
  businessTripId,
  transactionId,
  opened,
  close,
  onChange,
}: ModalProps): ReactElement {
  const { control, handleSubmit } = useForm<UpdateBusinessTripTransactionCategoryInput>({
    defaultValues: { businessTripId, transactionId },
  });

  const { updateBusinessTripTransactionCategory, fetching: updatingInProcess } =
    useUpdateBusinessTripTransactionCategory();

  const onSubmit: SubmitHandler<UpdateBusinessTripTransactionCategoryInput> = data => {
    updateBusinessTripTransactionCategory({ fields: data }).then(() => {
      onChange?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered>
      <Modal.Title>Add Attendee</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="category"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                data-autofocus
                {...field}
                data={categories}
                value={field.value}
                label="Category"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />

          <div className="flex justify-center mt-5 gap-3">
            <button
              type="submit"
              className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            >
              Confirm
            </button>
          </div>
        </form>
      </Modal.Body>
      {updatingInProcess && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
