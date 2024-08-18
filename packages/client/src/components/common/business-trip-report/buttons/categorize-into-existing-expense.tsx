import { forwardRef, ReactElement, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { LayoutGridAdd } from 'tabler-icons-react';
import { useQuery } from 'urql';
import {
  ActionIcon,
  Grid,
  Loader,
  Modal,
  NumberInput,
  Overlay,
  Select,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import {
  CategorizeIntoExistingBusinessTripExpenseInput,
  UncategorizedTransactionsByBusinessTripDocument,
  UncategorizedTransactionsByBusinessTripQuery,
} from '../../../../gql/graphql.js';
import { useCategorizeIntoExistingBusinessTripExpense } from '../../../../hooks/use-categorize-into-existing-business-trip-expense.js';

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
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Attach Uncategorized Transaction">
        <ActionIcon
          variant="default"
          onClick={(event): void => {
            event.stopPropagation();
            open();
          }}
          size={30}
        >
          <LayoutGridAdd size={20} />
        </ActionIcon>
      </Tooltip>
      {opened && (
        <ModalContent
          businessTripExpenseId={businessTripExpenseId}
          businessTripId={businessTripId}
          opened={opened}
          close={close}
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
    Array<ItemProps & { value: string }>
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
            sourceDescription: transaction.sourceDescription,
            referenceKey: transaction.referenceKey,
            counterparty: transaction.counterparty?.name,
            amount: transaction.amount.formatted,
            rawAmount: transaction.amount.raw,
            value: transaction.id,
            label: `${transaction.eventDate} | ${transaction.counterparty?.name} | ${transaction.amount.formatted}`,
          }))
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      );
    }
  }, [data, setUncategorizedTransactions]);

  useEffect(() => {
    if (error) {
      showNotification({
        title: 'Error!',
        message: 'Oops, we have an error fetching transactions to categorize',
      });
    }
  }, [error]);

  return (
    <Modal opened={opened} onClose={close} centered>
      <Modal.Title>Set Transaction Category</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 mt-3">
          <Controller
            name="transactionId"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                itemComponent={SelectItem}
                data={uncategorizedTransactions ?? []}
                disabled={fetchingUncategorizedTransactions}
                label="Transactions"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                error={fieldState.error?.message}
                withAsterisk
                withinPortal
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

interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
  eventDate?: string | null;
  sourceDescription?: string | null;
  referenceKey?: string | null;
  counterparty?: string | null;
  amount?: string | null;
  rawAmount?: number | null;
}

// eslint-disable-next-line react/display-name
const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
  (
    { eventDate, sourceDescription, referenceKey, counterparty, amount, ...other }: ItemProps,
    ref,
  ) => (
    <div ref={ref} {...other}>
      <Grid>
        <Grid.Col span={4}>{eventDate}</Grid.Col>
        <Grid.Col span={4}>
          <Text size="sm">{counterparty}</Text>
        </Grid.Col>
        <Grid.Col span={4}>
          <Text size="sm">{amount}</Text>
        </Grid.Col>
        <Grid.Col span={8}>
          <Text size="xs" opacity={0.65}>
            {sourceDescription}
          </Text>
        </Grid.Col>
        <Grid.Col span={4}>Reference: {referenceKey}</Grid.Col>
      </Grid>
    </div>
  ),
);
