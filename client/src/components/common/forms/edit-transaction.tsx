import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Loader, Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  CurrencyInput, // BeneficiariesInput,
  SimpleGrid, // TagsInput,
  TextInput,
} from '..';
import {
  AllFinancialAccountsDocument,
  AllFinancialEntitiesDocument,
  Currency,
  EditTransactionDocument,
  UpdateTransactionInput,
} from '../../../gql/graphql';
import { MakeBoolean, relevantDataPicker, TIMELESS_DATE_REGEX } from '../../../helpers';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditTransaction($transactionIDs: [ID!]!) {
    transactionsByIDs(transactionIDs: $transactionIDs) {
      id
      account {
        id
        ... on CardFinancialAccount {
          __typename
          fourDigits
          number
        }
        ... on BankFinancialAccount {
          __typename
          name
          accountNumber
        }
      }
      sourceDescription
      amount {
        raw
        currency
      }
      counterparty {
        id
        name
      }
      balance {
        raw
        currency
      }
      eventDate
      effectiveDate
    }
  }
`;

type Props = {
  transactionID: string;
  onDone?: () => void;
};

export const EditTransaction = ({ transactionID, onDone }: Props) => {
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
  const [financialAccounts, setFinancialAccounts] = useState<
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
    if (onDone) {
      onDone();
    }
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateTransaction({
        transactionId: transaction.id,
        fields: dataToUpdate,
      });
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

  const [
    {
      data: financialAccountsData,
      fetching: fetchingFinancialAccounts,
      error: financialAccountsError,
    },
  ] = useQuery({
    query: AllFinancialAccountsDocument,
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

  useEffect(() => {
    if (financialAccountsError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial accounts! 🤥',
        color: 'red',
      });
    }
  }, [financialAccountsError]);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (financialEntitiesData?.allFinancialEntities.length) {
      setFinancialEntities(
        financialEntitiesData.allFinancialEntities
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialEntitiesData, setFinancialEntities]);
  useEffect(() => {
    if (financialAccountsData?.allFinancialAccounts.length) {
      setFinancialAccounts(
        financialAccountsData?.allFinancialAccounts
          .map(account => ({
            value: account.id,
            label: account.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialAccountsData, setFinancialAccounts]);

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
                name="sourceDescription"
                control={transactionControl}
                defaultValue={transaction.sourceDescription}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Must be at least 2 characters' },
                }}
                render={({ field: { value, ...field }, fieldState }) => (
                  <TextInput
                    {...field}
                    value={value ?? undefined}
                    error={fieldState.error?.message}
                    label="Source Description"
                  />
                )}
              />
              <Controller
                name="counterpartyId"
                control={transactionControl}
                defaultValue={transaction.counterparty?.id}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }) => (
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
              <Controller
                name="accountId"
                control={transactionControl}
                defaultValue={transaction.account?.id}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    data={financialAccounts}
                    value={field.value}
                    disabled={fetchingFinancialAccounts}
                    label="Account"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="amount.raw"
                control={transactionControl}
                defaultValue={transaction.amount?.raw}
                render={({ field: amountField, fieldState: amountFieldState }) => (
                  <Controller
                    name="amount.currency"
                    control={transactionControl}
                    defaultValue={transaction.amount?.currency ?? Currency.Ils}
                    render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                      <CurrencyInput
                        {...amountField}
                        value={amountField.value ?? undefined}
                        error={
                          amountFieldState.error?.message || currencyCodeFieldState.error?.message
                        }
                        label="Amount"
                        currencyCodeProps={{ ...currencyCodeField, label: 'Currency' }}
                      />
                    )}
                  />
                )}
              />
              <Controller
                name="balance.raw"
                control={transactionControl}
                defaultValue={transaction.balance?.raw}
                render={({ field: amountField, fieldState: amountFieldState }) => (
                  <Controller
                    name="amount.currency"
                    control={transactionControl}
                    defaultValue={transaction.amount?.currency ?? Currency.Ils}
                    render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                      <CurrencyInput
                        {...amountField}
                        value={amountField.value ?? undefined}
                        error={
                          amountFieldState.error?.message || currencyCodeFieldState.error?.message
                        }
                        label="Balance"
                        currencyCodeProps={{
                          ...currencyCodeField,
                          label: 'Currency',
                          disabled: true,
                        }}
                      />
                    )}
                  />
                )}
              />
              <Controller
                name="eventDate"
                control={transactionControl}
                defaultValue={transaction.eventDate}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    {...field}
                    label="Event Date"
                    placeholder="Pick date and time"
                    value={field.value ? new Date(field.value) : undefined}
                    valueFormat="DD/MM/YY"
                    error={fieldState.error?.message}
                    onChange={date => date && field.onChange(format(new Date(date), 'yyyy-MM-dd'))}
                  />
                )}
              />
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
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    {...field}
                    label="Effective Date"
                    placeholder="Pick date"
                    value={field.value ? new Date(field.value) : undefined}
                    valueFormat="DD/MM/YY"
                    error={fieldState.error?.message}
                    onChange={date => date && field.onChange(format(new Date(date), 'yyyy-MM-dd'))}
                  />
                )}
              />
            </SimpleGrid>
          </div>
          <div className="mt-10 mb-5 flex justify-center gap-5">
            <button
              type="submit"
              onClick={() => handleTransactionSubmit(onTransactionSubmit)}
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
