import { ReactElement, useCallback, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Loader } from '@mantine/core';
import {
  EditMiscExpenseFieldsFragmentDoc,
  UpdateAuthoritiesExpenseInput,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useUpdateAuthoritiesMiscExpense } from '../../../hooks/use-update-authority-misc-expense.js';
import { ModifyMiscExpenseFields } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment EditMiscExpenseFields on AuthoritiesExpense {
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
  } = useForm<UpdateAuthoritiesExpenseInput>({
    defaultValues: {
      amount: expense.amount.raw,
      description: expense.description,
      date: expense.date,
      counterpartyId: expense.counterparty?.id,
    },
  });
  const { updateAuthoritiesMiscExpense, fetching } = useUpdateAuthoritiesMiscExpense();

  const onUpdateDone = useCallback(
    async (data: UpdateAuthoritiesExpenseInput) => {
      setIsUpdating(true);
      await updateAuthoritiesMiscExpense({
        transactionId: expense.transactionId,
        fields: data,
      });
      onDone();
      setIsUpdating(false);
    },
    [updateAuthoritiesMiscExpense, onDone, expense.transactionId],
  );
  const onSubmit: SubmitHandler<UpdateAuthoritiesExpenseInput> = data => {
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
