import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Loader, Select, Switch } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { EditTransactionDocument, UpdateTransactionInput } from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { SimpleGrid } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditTransaction($transactionIDs: [UUID!]!) {
    transactionsByIDs(transactionIDs: $transactionIDs) {
      id
      counterparty {
        id
        name
      }
      effectiveDate
      isFee
      account {
        __typename
        id
      }
    }
  }
`;

type Props = {
  transactionID: string;
  onDone?: () => void;
  onChange: () => void;
};

export const EditTransaction = ({ transactionID, onDone, onChange }: Props): ReactElement => {
  const [{ data: transactionData, fetching: fetchingTransaction }] = useQuery({
    query: EditTransactionDocument,
    variables: {
      transactionIDs: [transactionID],
    },
  });

  const transaction = transactionData?.transactionsByIDs?.[0];
  const useFormManager = useForm<UpdateTransactionInput>({
    defaultValues: { ...transaction },
  });

  const {
    control: transactionControl,
    handleSubmit: handleTransactionSubmit,
    formState: { dirtyFields: dirtyChargeFields },
  } = useFormManager;

  const { updateTransaction, fetching: isUpdating } = useUpdateTransaction();

  const onTransactionSubmit: SubmitHandler<UpdateTransactionInput> = data => {
    if (!transaction) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyChargeFields as MakeBoolean<typeof data>);
    onDone?.();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateTransaction({
        transactionId: transaction.id,
        fields: dataToUpdate,
      }).then(onChange);
    }
  };

  const { selectableFinancialEntities: financialEntities, fetching: fetchingFinancialEntities } =
    useGetFinancialEntities();

  return (
    <>
      {fetchingTransaction && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetchingTransaction && transaction && (
        <form onSubmit={handleTransactionSubmit(onTransactionSubmit)}>
          <div className="flex-row px-10 h-max justify-start block">
            <SimpleGrid cols={3}>
              <Controller
                name="counterpartyId"
                control={transactionControl}
                defaultValue={transaction.counterparty?.id}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <Select
                    {...field}
                    data={financialEntities}
                    value={field.value}
                    disabled={fetchingFinancialEntities}
                    label="Counterparty"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
              {transaction?.account.__typename === 'CardFinancialAccount' ? (
                <Controller
                  name="effectiveDate"
                  control={transactionControl}
                  defaultValue={transaction.effectiveDate}
                  rules={{
                    pattern: {
                      value: TIMELESS_DATE_REGEX,
                      message: 'Date must be im format yyyy-mm-dd',
                    },
                  }}
                  render={({ field, fieldState }): ReactElement => (
                    <DatePickerInput
                      {...field}
                      onChange={(date?: Date | string | null): void => {
                        const newDate = date
                          ? typeof date === 'string'
                            ? date
                            : format(date, 'yyyy-MM-dd')
                          : undefined;
                        if (newDate !== field.value) field.onChange(newDate);
                      }}
                      value={field.value ? new Date(field.value) : undefined}
                      label="Effective Date"
                      error={fieldState.error?.message}
                      popoverProps={{ withinPortal: true }}
                    />
                  )}
                />
              ) : (
                // eslint-disable-next-line react/jsx-no-useless-fragment
                <></>
              )}
              <Controller
                name="isFee"
                control={transactionControl}
                defaultValue={transaction.isFee}
                render={({ field: { value, ...field } }): ReactElement => (
                  <Switch {...field} checked={value === true} label="Is Fee" />
                )}
              />
            </SimpleGrid>
          </div>
          <div className="mt-10 mb-5 flex justify-center gap-5">
            <button
              type="submit"
              onClick={(): (() => void) => handleTransactionSubmit(onTransactionSubmit)}
              className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
              disabled={isUpdating || Object.keys(dirtyChargeFields).length === 0}
            >
              Accept
            </button>
            <button
              type="button"
              className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-rose-600 rounded-sm text-lg"
              onClick={onDone}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
};
