import { ReactElement, useCallback, useMemo, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Loader } from '@mantine/core';
import { ModifyMiscExpenseFields } from '.';
import {
  InsertAuthoritiesExpenseInput,
  MiscExpenseTransactionFieldsDocument,
} from '../../../gql/graphql.js';
import { useInsertAuthorityMiscExpense } from '../../../hooks/use-insert-authority-misc-expense.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MiscExpenseTransactionFields($transactionId: UUID!) {
    transactionsByIDs(transactionIDs: [$transactionId]) {
      id
      amount {
        currency
      }
    }
  }
`;

type Props = {
  onDone: () => void;
  transactionId: string;
};

type Input = Omit<InsertAuthoritiesExpenseInput, 'transactionId'>;

export const InsertMiscExpense = ({ onDone, transactionId }: Props): ReactElement => {
  const [isInserting, setIsInserting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<Input>();
  const { insertAuthorityMiscExpense, fetching } = useInsertAuthorityMiscExpense();

  const [{ data: transactionData, fetching: fetchingTransaction }] = useQuery({
    query: MiscExpenseTransactionFieldsDocument,
    variables: {
      transactionId,
    },
  });

  const transaction = useMemo(() => {
    return transactionData?.transactionsByIDs[0];
  }, [transactionData]);

  const onInsertDone = useCallback(
    async (data: Input) => {
      setIsInserting(true);
      await insertAuthorityMiscExpense({
        fields: { ...data, transactionId },
      });
      onDone();
      setIsInserting(false);
    },
    [insertAuthorityMiscExpense, onDone, transactionId],
  );
  const onSubmit: SubmitHandler<Input> = data => {
    if (data && Object.keys(data).length > 0) {
      onInsertDone({ ...data });
    }
  };

  const isLoading = useMemo(() => {
    return isInserting || fetchingTransaction || !transaction;
  }, [isInserting, fetchingTransaction, transaction]);

  return isLoading ? (
    <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
  ) : (
    <form>
      <div className="px-5 flex flex-col gap-5">
        <ModifyMiscExpenseFields
          control={control}
          currency={transaction!.amount.currency}
          isInsert
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
