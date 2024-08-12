import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import {
  BusinessTripReportOtherRowFieldsFragmentDoc,
  UpdateBusinessTripOtherExpenseInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripOtherExpense } from '../../../../hooks/use-update-business-trip-other-expense.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportOtherRowFields on BusinessTripOtherExpense {
    id
    ...BusinessTripReportCoreExpenseRowFields
    payedByEmployee
    description
    deductibleExpense
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportOtherRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const OtherRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const otherExpense = getFragmentData(BusinessTripReportOtherRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripOtherExpenseInput>({
    defaultValues: {
      id: otherExpense.id,
      businessTripId,
    },
  });

  const { updateBusinessTripOtherExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripOtherExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripOtherExpenseInput> = data => {
    updateBusinessTripOtherExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={otherExpense.id}>
      <CoreExpenseRow
        data={otherExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${otherExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="description"
              control={control}
              defaultValue={otherExpense.description}
              render={({ field, fieldState }): ReactElement => (
                <TextInput
                  form={`form ${otherExpense.id}`}
                  data-autofocus={otherExpense.payedByEmployee ? undefined : true}
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Description"
                />
              )}
            />
          ) : (
            <Text c={otherExpense.description ? undefined : 'red'}>
              {otherExpense.description ?? 'Missing'}
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
              defaultValue={otherExpense.deductibleExpense}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <Switch
                  {...field}
                  form={`form ${otherExpense.id}`}
                  checked={value === true}
                  error={fieldState.error?.message}
                  label="Deductible Expense"
                />
              )}
            />
          ) : (
            <Text c={otherExpense.deductibleExpense ? undefined : 'red'}>
              {otherExpense.deductibleExpense === true
                ? 'Yes'
                : otherExpense.deductibleExpense === false
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
            <ActionIcon type="submit" form={`form ${otherExpense.id}`} variant="default" size={30}>
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={otherExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense businessTripExpenseId={otherExpense.id} onDelete={onChange} />
      </td>
    </tr>
  );
};
