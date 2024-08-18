import { ReactElement } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, NumberInput, Overlay, Select, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BusinessTripExpenseCategories,
  CategorizeBusinessTripExpenseInput,
} from '../../../../gql/graphql.js';
import { useCategorizeBusinessTripExpense } from '../../../../hooks/use-categorize-business-trip-expense.js';

export function CategorizeExpense(props: {
  businessTripId: string;
  transactionId: string;
  defaultAmount?: number;
  onChange: () => void;
}): ReactElement {
  const { businessTripId, transactionId, onChange, defaultAmount } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Categorize">
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
          defaultAmount={defaultAmount}
        />
      )}
    </>
  );
}

const categories = Object.entries(BusinessTripExpenseCategories).map(([key, value]) => ({
  value,
  label: key,
}));

type ModalProps = {
  opened: boolean;
  close: () => void;
  onChange: () => void;
  businessTripId: string;
  transactionId: string;
  defaultAmount?: number;
};

function ModalContent({
  businessTripId,
  transactionId,
  defaultAmount,
  opened,
  close,
  onChange,
}: ModalProps): ReactElement {
  const { control, handleSubmit } = useForm<CategorizeBusinessTripExpenseInput>({
    defaultValues: { businessTripId, transactionId },
  });

  const { categorizeBusinessTripExpense, fetching: updatingInProcess } =
    useCategorizeBusinessTripExpense();

  const onSubmit: SubmitHandler<CategorizeBusinessTripExpenseInput> = data => {
    categorizeBusinessTripExpense({ fields: data }).then(() => {
      onChange?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered>
      <Modal.Title>Set Expense Category</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 mt-3">
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
          <Controller
            name="amount"
            control={control}
            defaultValue={defaultAmount}
            render={({ field, fieldState }): ReactElement => (
              <NumberInput
                {...field}
                value={field.value ?? undefined}
                hideControls
                precision={2}
                removeTrailingZeros
                error={fieldState.error?.message}
                label="Amount"
              />
            )}
          />

          <div className="flex justify-center gap-3">
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
