import { ReactElement, useCallback } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Loader2 } from 'tabler-icons-react';
import { InsertMiscExpenseInput } from '../../../gql/graphql.js';
import { useInsertMiscExpense } from '../../../hooks/use-insert-misc-expense.js';
import { ModifyMiscExpenseFields } from './index.js';

type Props = {
  onDone: () => void;
  defaultValues?: Partial<Omit<InsertMiscExpenseInput, 'chargeId'>>;
  chargeId: string;
};

export const InsertMiscExpense = ({
  onDone,
  defaultValues = {},
  chargeId,
}: Props): ReactElement => {
  const { insertMiscExpense, fetching } = useInsertMiscExpense();

  const onInsertDone = useCallback(
    async (data: InsertMiscExpenseInput) => {
      await insertMiscExpense({
        fields: data,
      });
      onDone();
    },
    [insertMiscExpense, onDone],
  );

  return (
    <InsertForm
      chargeId={chargeId}
      defaultValues={defaultValues}
      onInsertDone={onInsertDone}
      fetching={fetching}
    />
  );
};

type FormProps = {
  onInsertDone: (data: InsertMiscExpenseInput) => Promise<void>;
  chargeId: string;
  defaultValues: Partial<Omit<InsertMiscExpenseInput, 'chargeId'>>;
  fetching: boolean;
};

export const InsertForm = ({
  onInsertDone,
  chargeId,
  defaultValues,
  fetching,
}: FormProps): ReactElement => {
  const onSubmit: SubmitHandler<InsertMiscExpenseInput> = data => {
    if (data && Object.keys(data).length > 0) {
      onInsertDone({ ...data });
    }
  };

  const formManager = useForm<InsertMiscExpenseInput>({
    defaultValues: {
      chargeId,
      ...defaultValues,
    },
  });

  const {
    handleSubmit,
    formState: { dirtyFields },
  } = formManager;

  return (
    <form>
      <div className="px-5 flex flex-col gap-5 relative">
        {fetching && (
          <div className="absolute bg-white/60 z-10 h-full w-full flex items-center justify-center">
            <div className="flex items-center">
              <span className="text-3xl mr-4">
                <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
              </span>
            </div>
          </div>
        )}
        <ModifyMiscExpenseFields
          formManager={formManager as Parameters<typeof ModifyMiscExpenseFields>[0]['formManager']}
          isInsert
        />
        <div className="flex justify-right gap-5 mt-5">
          <button
            type="button"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
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
