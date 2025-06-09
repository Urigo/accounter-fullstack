import { ReactElement, useEffect } from 'react';
import { format } from 'date-fns';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Loader } from '@mantine/core';
import { EditTransactionDocument, UpdateTransactionInput } from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';
import { Switch } from '../../ui/switch.js';
import { DatePickerInput, SimpleGrid } from '../index.js';

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
  const formManager = useForm<UpdateTransactionInput>({
    defaultValues: transaction ?? ({} as UpdateTransactionInput),
  });

  useEffect(() => {
    if (transaction) {
      formManager.reset({
        counterpartyId: transaction.counterparty?.id,
        effectiveDate: transaction.effectiveDate,
        isFee: transaction.isFee,
      });
    }
  }, [transaction, formManager]);

  // Ensure the form is hydrated once the data arrives
  useEffect(() => {
    if (transaction) formManager.reset(transaction);
  }, [transaction, formManager]);

  const {
    control,
    handleSubmit,
    formState: { dirtyFields: dirtyChargeFields },
  } = formManager;

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
        <Form {...formManager}>
          <form onSubmit={handleSubmit(onTransactionSubmit)}>
            <div className="flex-row px-10 h-max justify-start block">
              <SimpleGrid cols={3}>
                <FormField
                  name="counterpartyId"
                  control={control}
                  defaultValue={transaction.counterparty?.id}
                  rules={{
                    minLength: { value: 2, message: 'Minimum 2 characters' },
                  }}
                  render={({ field }): ReactElement => (
                    <FormItem>
                      <FormLabel>Counterparty</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? undefined}
                        disabled={fetchingFinancialEntities}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue placeholder="Scroll to see all options" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent onClick={event => event.stopPropagation()}>
                          {financialEntities.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {transaction?.account.__typename === 'CardFinancialAccount' ? (
                  <FormField
                    name="effectiveDate"
                    control={control}
                    rules={{
                      pattern: {
                        value: TIMELESS_DATE_REGEX,
                        message: 'Date must be im format yyyy-mm-dd',
                      },
                    }}
                    render={({ field }): ReactElement => (
                      <FormItem>
                        <FormLabel>Effective Date</FormLabel>
                        <FormControl>
                          <DatePickerInput
                            {...field}
                            onChange={(date?: Date | null): void => {
                              const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                              if (newDate !== field.value) field.onChange(newDate);
                            }}
                            value={field.value ? new Date(field.value) : undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  // eslint-disable-next-line react/jsx-no-useless-fragment
                  <></>
                )}
                <FormField
                  name="isFee"
                  control={control}
                  defaultValue={transaction.isFee}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Fee Transaction</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </SimpleGrid>
            </div>
            <div className="mt-10 mb-5 flex justify-center gap-5">
              <button
                type="submit"
                onClick={(): (() => void) => handleSubmit(onTransactionSubmit)}
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
        </Form>
      )}
    </>
  );
};
