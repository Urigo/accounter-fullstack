import { ReactElement, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Loader, Select, Switch } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AllFinancialEntitiesDocument,
  EditTransactionDocument,
  UpdateTransactionInput,
} from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { SimpleGrid, TextInput } from '../index.js';

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

  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);
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

  const [
    {
      data: financialEntitiesData,
      fetching: fetchingFinancialEntities,
      error: financialEntitiesError,
    },
  ] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
        color: 'red',
      });
    }
  }, [financialEntitiesError]);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (financialEntitiesData?.allFinancialEntities?.nodes.length) {
      setFinancialEntities(
        financialEntitiesData.allFinancialEntities.nodes
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialEntitiesData, setFinancialEntities]);

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
                    <TextInput
                      {...field}
                      value={field.value ?? undefined}
                      error={fieldState.error?.message}
                      isDirty={fieldState.isDirty}
                      label="Effective Date"
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
              className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
              disabled={isUpdating || Object.keys(dirtyChargeFields).length === 0}
            >
              Accept
            </button>
            <button
              type="button"
              className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
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
