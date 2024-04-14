import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, Text, TextInput, Tooltip } from '@mantine/core';
import {
  BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
  UpdateBusinessTripTravelAndSubsistenceTransactionInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripTravelAndSubsistenceTransaction } from '../../../../hooks/use-update-business-trip-travel-and-subsistence-transaction.js';
import { DeleteBusinessTripTransaction } from '../buttons/delete-business-trip-transaction.js';
import { CoreTransactionRow } from './core-transaction-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportTravelAndSubsistenceRowFields on BusinessTripTravelAndSubsistenceTransaction {
      id
      ...BusinessTripReportCoreTransactionRowFields
      payedByEmployee
      expenseType
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange?: () => void;
}

export const TravelAndSubsistenceRow = ({
  data,
  businessTripId,
  onChange,
}: Props): ReactElement => {
  const travelAndSubsistenceTransaction = getFragmentData(
    BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
    data,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripTravelAndSubsistenceTransactionInput>(
    {
      defaultValues: {
        id: travelAndSubsistenceTransaction.id,
        businessTripId,
      },
    },
  );

  const { updateBusinessTripTravelAndSubsistenceTransaction, fetching: updatingInProcess } =
    useUpdateBusinessTripTravelAndSubsistenceTransaction();

  const onSubmit: SubmitHandler<UpdateBusinessTripTravelAndSubsistenceTransactionInput> = data => {
    updateBusinessTripTravelAndSubsistenceTransaction({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
      close();
    });
  };

  return (
    <tr key={travelAndSubsistenceTransaction.id}>
      <CoreTransactionRow
        data={travelAndSubsistenceTransaction}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${travelAndSubsistenceTransaction.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="expenseType"
              control={control}
              defaultValue={travelAndSubsistenceTransaction.expenseType}
              render={({ field, fieldState }): ReactElement => (
                <TextInput
                  form={`form ${travelAndSubsistenceTransaction.id}`}
                  data-autofocus={
                    travelAndSubsistenceTransaction.payedByEmployee ? undefined : true
                  }
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Expense Type"
                />
              )}
            />
          ) : (
            <Text c={travelAndSubsistenceTransaction.expenseType ? undefined : 'red'}>
              {travelAndSubsistenceTransaction.expenseType ?? 'Missing'}
            </Text>
          )}
        </form>
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
              form={`form ${travelAndSubsistenceTransaction.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteBusinessTripTransaction
          businessTripTransactionId={travelAndSubsistenceTransaction.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
