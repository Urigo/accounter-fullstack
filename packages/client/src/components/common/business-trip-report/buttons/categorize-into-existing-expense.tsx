import { useEffect, useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  UncategorizedTransactionsByBusinessTripDocument,
  type CategorizeIntoExistingBusinessTripExpenseInput,
  type UncategorizedTransactionsByBusinessTripQuery,
} from '../../../../gql/graphql.js';
import { useCategorizeIntoExistingBusinessTripExpense } from '../../../../hooks/use-categorize-into-existing-business-trip-expense.js';
import { Button } from '../../../ui/button.js';
import { LoadingOverlay } from '../../../ui/overlay.js';
import { ComboBox, PopUpModal, Tooltip } from '../../index.js';
import { NumberInput } from '../../inputs/number-input.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query UncategorizedTransactionsByBusinessTrip($businessTripId: UUID!) {
    businessTrip(id: $businessTripId) {
      id
      uncategorizedTransactions {
        transaction {
          id
          eventDate
          sourceDescription
          referenceKey
          counterparty {
            id
            name
          }
          amount {
            formatted
            raw
          }
        }
      }
    }
  }
`;

export function CategorizeIntoExistingExpense(props: {
  businessTripExpenseId: string;
  businessTripId: string;
  onChange: () => void;
}): ReactElement {
  const { businessTripExpenseId, businessTripId, onChange } = props;
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Tooltip content="Attach Uncategorized Transaction">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(event): void => {
            event.stopPropagation();
            setOpened(true);
          }}
        >
          <Plus className="size-5" />
        </Button>
      </Tooltip>
      {opened && (
        <ModalContent
          businessTripExpenseId={businessTripExpenseId}
          businessTripId={businessTripId}
          opened={opened}
          close={() => setOpened(false)}
          onChange={onChange}
        />
      )}
    </>
  );
}

type ModalProps = {
  opened: boolean;
  close: () => void;
  onChange: () => void;
  businessTripExpenseId: string;
  businessTripId: string;
};

type UncategorizedTransaction = Exclude<
  NonNullable<
    UncategorizedTransactionsByBusinessTripQuery['businessTrip']
  >['uncategorizedTransactions'][number],
  null
>;

function ModalContent({
  businessTripExpenseId,
  businessTripId,
  opened,
  close,
  onChange,
}: ModalProps): ReactElement {
  const { control, handleSubmit, setValue } =
    useForm<CategorizeIntoExistingBusinessTripExpenseInput>({
      defaultValues: { businessTripExpenseId },
    });
  const [uncategorizedTransactions, setUncategorizedTransactions] = useState<
    Array<UncategorizedTransactionOption>
  >([]);
  const [{ data, fetching: fetchingUncategorizedTransactions, error }] = useQuery({
    query: UncategorizedTransactionsByBusinessTripDocument,
    variables: { businessTripId },
  });

  const { categorizeIntoExistingBusinessTripExpense, fetching: updatingInProcess } =
    useCategorizeIntoExistingBusinessTripExpense();

  const onSubmit: SubmitHandler<CategorizeIntoExistingBusinessTripExpenseInput> = data => {
    categorizeIntoExistingBusinessTripExpense({ fields: data }).then(() => {
      onChange?.();
      close();
    });
  };

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (data?.businessTrip?.uncategorizedTransactions.length) {
      const uncategorizedTransactions = data.businessTrip.uncategorizedTransactions.filter(
        entity => entity?.transaction,
      ) as UncategorizedTransaction[];
      setUncategorizedTransactions(
        uncategorizedTransactions
          .map(({ transaction }) => ({
            eventDate: transaction.eventDate,
            rawAmount: transaction.amount.raw,
            value: transaction.id,
            label: `${transaction.eventDate} | ${transaction.counterparty?.name} | ${transaction.amount.formatted}`,
            // Mantine's `itemComponent` laid the description and reference out in their own
            // grid rows; ComboBox gives each option a second line, so they are joined into it.
            description: [
              transaction.sourceDescription,
              transaction.referenceKey ? `Reference: ${transaction.referenceKey}` : null,
            ]
              .filter((part): part is string => !!part)
              .join(' · '),
          }))
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      );
    }
  }, [data, setUncategorizedTransactions]);

  useEffect(() => {
    if (error) {
      toast.error('Error', {
        description: 'Oops, we have an error fetching transactions to categorize',
      });
    }
  }, [error]);

  return (
    <PopUpModal opened={opened} onClose={close} withCloseButton title="Set Transaction Category">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 mt-3">
        <Controller
          name="transactionId"
          control={control}
          render={({ field, fieldState }): ReactElement => (
            <ComboBox
              {...field}
              data={uncategorizedTransactions}
              disabled={fetchingUncategorizedTransactions}
              label="Transactions"
              required
              placeholder="Scroll to see all options"
              error={fieldState.error?.message}
              onChange={transactionId => {
                const transaction = uncategorizedTransactions.find(
                  transaction => transaction.value === transactionId,
                );
                if (transaction?.rawAmount) {
                  setValue('amount', transaction.rawAmount);
                }
                field.onChange(transactionId);
              }}
            />
          )}
        />
        <Controller
          name="amount"
          control={control}
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

type UncategorizedTransactionOption = {
  value: string;
  label: string;
  description: string;
  eventDate: string;
  rawAmount?: number | null;
};
