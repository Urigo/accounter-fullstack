import { useCallback, useState, type ReactElement } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Loader } from '@mantine/core';
import {
  EditMiscExpenseFieldsFragmentDoc,
  type UpdateMiscExpenseInput,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { useUpdateMiscExpense } from '../../../hooks/use-update-misc-expense.js';
import { Form } from '../../ui/form.js';
import { ModifyMiscExpenseFields } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment EditMiscExpenseFields on MiscExpense {
    id
    amount {
      raw
      currency
    }
    description
    invoiceDate
    valueDate
    creditor {
      id
    }
    debtor {
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
  const formManager = useForm<UpdateMiscExpenseInput>({
    defaultValues: {
      amount: expense.amount.raw,
      currency: expense.amount.currency,
      description: expense.description,
      valueDate: new Date(expense.valueDate),
      invoiceDate: expense.invoiceDate,
      creditorId: expense.creditor.id,
      debtorId: expense.debtor.id,
    },
  });
  const {
    handleSubmit,
    formState: { dirtyFields },
  } = formManager;
  const { updateMiscExpense, fetching } = useUpdateMiscExpense();

  const onUpdateDone = useCallback(
    async (data: UpdateMiscExpenseInput) => {
      setIsUpdating(true);
      await updateMiscExpense({
        id: expense.id,
        fields: data,
      });
      onDone();
      setIsUpdating(false);
    },
    [updateMiscExpense, onDone, expense.id],
  );
  const onSubmit: SubmitHandler<UpdateMiscExpenseInput> = data => {
    if (data && Object.keys(data).length > 0) {
      onUpdateDone({ ...data });
    }
  };

  return isUpdating ? (
    <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
  ) : (
    <Form {...formManager}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-5 flex flex-col gap-5">
          <ModifyMiscExpenseFields formManager={formManager} isInsert={false} />
          <div className="flex justify-right gap-5 mt-5">
            <button
              type="submit"
              className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
              disabled={fetching || Object.keys(dirtyFields).length === 0}
            >
              Accept
            </button>
          </div>
        </div>
      </form>
    </Form>
  );
};
