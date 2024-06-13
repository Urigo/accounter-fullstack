import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { UpdateBusinessTripOtherTransactionInput } from '../../../../gql/graphql.js';
import { graphql } from '../../../../graphql.js';
import { useUpdateBusinessTripOtherTransaction } from '../../../../hooks/use-update-business-trip-other-transaction.js';
import { DeleteBusinessTripTransaction } from '../buttons/delete-business-trip-transaction.jsx';
import { CoreTransactionRow } from './core-transaction-row.jsx';

export const BusinessTripReportOtherRowFieldsFragmentDoc = graphql(`
  fragment BusinessTripReportOtherRowFields on BusinessTripOtherTransaction {
    id
    ...BusinessTripReportCoreTransactionRowFields
    payedByEmployee
    expenseType
    deductibleExpense
  }
`);

interface Props {
  data: FragmentOf<typeof BusinessTripReportOtherRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const OtherRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const otherTransaction = readFragment(BusinessTripReportOtherRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripOtherTransactionInput>({
    defaultValues: {
      id: otherTransaction.id,
      businessTripId,
    },
  });

  const { updateBusinessTripOtherTransaction, fetching: updatingInProcess } =
    useUpdateBusinessTripOtherTransaction();

  const onSubmit: SubmitHandler<UpdateBusinessTripOtherTransactionInput> = data => {
    updateBusinessTripOtherTransaction({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
      close();
    });
  };

  return (
    <tr key={otherTransaction.id}>
      <CoreTransactionRow
        data={otherTransaction}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${otherTransaction.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="expenseType"
              control={control}
              defaultValue={otherTransaction.expenseType}
              render={({ field, fieldState }): ReactElement => (
                <TextInput
                  form={`form ${otherTransaction.id}`}
                  data-autofocus={otherTransaction.payedByEmployee ? undefined : true}
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Expense Type"
                />
              )}
            />
          ) : (
            <Text c={otherTransaction.expenseType ? undefined : 'red'}>
              {otherTransaction.expenseType ?? 'Missing'}
            </Text>
          )}
        </form>
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode ? (
            <Controller
              name="deductibleExpense"
              control={control}
              defaultValue={otherTransaction.deductibleExpense}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <Switch
                  {...field}
                  form={`form ${otherTransaction.id}`}
                  checked={value === true}
                  error={fieldState.error?.message}
                  label="Deductible Expense"
                />
              )}
            />
          ) : (
            <Text c={otherTransaction.deductibleExpense ? undefined : 'red'}>
              {otherTransaction.deductibleExpense === true
                ? 'Yes'
                : otherTransaction.deductibleExpense === false
                  ? 'No'
                  : 'Missing'}
            </Text>
          )}
        </div>
      </td>
      <td>
        <Tooltip label="Edit">
          <ActionIcon
            loading={updatingInProcess}
            variant={isEditMode ? 'filled' : 'default'}
            onClick={(event): void => {
              event.stopPropagation();
              setIsEditMode(curr => !curr);
            }}
            size={30}
          >
            <Edit size={20} />
          </ActionIcon>
        </Tooltip>
        {isEditMode && (
          <Tooltip label="Confirm Changes">
            <ActionIcon
              type="submit"
              form={`form ${otherTransaction.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteBusinessTripTransaction
          businessTripTransactionId={otherTransaction.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
