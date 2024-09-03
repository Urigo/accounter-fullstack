import { ReactElement, useCallback, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Loader } from '@mantine/core';
import { EditMiscExpenseFieldsFragmentDoc, UpdateMiscExpenseInput } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useUpdateMiscExpense } from '../../../hooks/use-update-misc-expense.js';
import { ModifyMiscExpenseFields } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment EditMiscExpenseFields on MiscExpense {
    transactionId
    amount {
      raw
      currency
    }
    description
    date
    counterparty {
      id
    }
  }
`;

type Props = {
  onDone: () => void;
  data: FragmentType<typeof EditMiscExpenseFieldsFragmentDoc>;
};

export const EditMiscExpense = ({ onDone, data }: Props): ReactElement => {
  const [isUpdating, setIsUpdating] = useState(false);
  const expense = getFragmentData(EditMiscExpenseFieldsFragmentDoc, data);
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<UpdateMiscExpenseInput>({
    defaultValues: {
      amount: expense.amount.raw,
      description: expense.description,
      date: expense.date,
      counterpartyId: expense.counterparty?.id,
    },
  });
  const { updateMiscExpense, fetching } = useUpdateMiscExpense();

  const onUpdateDone = useCallback(
    async (data: UpdateMiscExpenseInput) => {
      setIsUpdating(true);
      await updateMiscExpense({
        transactionId: expense.transactionId,
        counterpartyId: expense.counterparty.id,
        fields: data,
      });
      onDone();
      setIsUpdating(false);
    },
    [updateMiscExpense, onDone, expense.transactionId, expense.counterparty.id],
  );
  const onSubmit: SubmitHandler<UpdateMiscExpenseInput> = data => {
    if (data && Object.keys(data).length > 0) {
      onUpdateDone({ ...data });
    }
  };

  return isUpdating ? (
    <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
  ) : (
    <form>
      <div className="px-5 flex flex-col gap-5">
        <ModifyMiscExpenseFields
          control={control}
          currency={expense.amount.currency}
          isInsert={false}
        />
        <div className="flex justify-right gap-5 mt-5">
          <button
            type="button"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={fetching || Object.keys(dirtyFields).length === 0}
            onClick={handleSubmit(onSubmit)}
          >
            Accept
          </button>
        </div>
      </div>
    </form>
  );
};
