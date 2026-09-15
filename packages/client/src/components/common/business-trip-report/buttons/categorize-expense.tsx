import { useState, type ReactElement } from 'react';
import { Edit } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import {
  BusinessTripExpenseCategories,
  type CategorizeBusinessTripExpenseInput,
} from '../../../../gql/graphql.js';
import { useCategorizeBusinessTripExpense } from '../../../../hooks/use-categorize-business-trip-expense.js';
import { Button } from '../../../ui/button.js';
import { LoadingOverlay } from '../../../ui/overlay.js';
import { ComboBox, PopUpModal, Tooltip } from '../../index.js';
import { NumberInput } from '../../inputs/number-input.js';

export function CategorizeExpense(props: {
  businessTripId: string;
  transactionId: string;
  defaultAmount?: number;
  onChange: () => void;
}): ReactElement {
  const { businessTripId, transactionId, onChange, defaultAmount } = props;
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Tooltip content="Categorize">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(event): void => {
            event.stopPropagation();
            setOpened(true);
          }}
        >
          <Edit className="size-5" />
        </Button>
      </Tooltip>
      {opened && (
        <ModalContent
          businessTripId={businessTripId}
          transactionId={transactionId}
          opened={opened}
          close={() => setOpened(false)}
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
    <PopUpModal opened={opened} onClose={close} withCloseButton title="Set Expense Category">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 mt-3">
        <Controller
          name="category"
          control={control}
          render={({ field, fieldState }): ReactElement => (
            <ComboBox
              {...field}
              data={categories}
              value={field.value}
              label="Category"
              placeholder="Scroll to see all options"
              error={fieldState.error?.message}
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
              decimalScale={2}
              error={fieldState.error?.message}
              label="Amount"
            />
          )}
        />

        <div className="flex justify-center gap-3">
          <button
            type="submit"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
          >
            Confirm
          </button>
        </div>
      </form>
      <LoadingOverlay visible={updatingInProcess} blur={1} />
    </PopUpModal>
  );
}
