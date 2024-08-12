import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, Text, TextInput, Tooltip } from '@mantine/core';
import {
  BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
  UpdateBusinessTripTravelAndSubsistenceExpenseInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripTravelAndSubsistenceExpense } from '../../../../hooks/use-update-business-trip-travel-and-subsistence-expense.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportTravelAndSubsistenceRowFields on BusinessTripTravelAndSubsistenceExpense {
    id
    ...BusinessTripReportCoreExpenseRowFields
    payedByEmployee
    expenseType
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const TravelAndSubsistenceRow = ({
  data,
  businessTripId,
  onChange,
}: Props): ReactElement => {
  const travelAndSubsistenceExpense = getFragmentData(
    BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
    data,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripTravelAndSubsistenceExpenseInput>({
    defaultValues: {
      id: travelAndSubsistenceExpense.id,
      businessTripId,
    },
  });

  const { updateBusinessTripTravelAndSubsistenceExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripTravelAndSubsistenceExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripTravelAndSubsistenceExpenseInput> = data => {
    updateBusinessTripTravelAndSubsistenceExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={travelAndSubsistenceExpense.id}>
      <CoreExpenseRow
        data={travelAndSubsistenceExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${travelAndSubsistenceExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="expenseType"
              control={control}
              defaultValue={travelAndSubsistenceExpense.expenseType}
              render={({ field, fieldState }): ReactElement => (
                <TextInput
                  form={`form ${travelAndSubsistenceExpense.id}`}
                  data-autofocus={travelAndSubsistenceExpense.payedByEmployee ? undefined : true}
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Expense Type"
                />
              )}
            />
          ) : (
            <Text c={travelAndSubsistenceExpense.expenseType ? undefined : 'red'}>
              {travelAndSubsistenceExpense.expenseType ?? 'Missing'}
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
              form={`form ${travelAndSubsistenceExpense.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={travelAndSubsistenceExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense
          businessTripExpenseId={travelAndSubsistenceExpense.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
