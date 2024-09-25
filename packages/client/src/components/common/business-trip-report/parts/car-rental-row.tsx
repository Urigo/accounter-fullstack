import { ReactElement, useState } from 'react';
import { Car, Fuel } from 'lucide-react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, NumberInput, Switch, Text, Tooltip } from '@mantine/core';
import {
  BusinessTripReportCarRentalRowFieldsFragmentDoc,
  UpdateBusinessTripCarRentalExpenseInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripCarRentalExpense } from '../../../../hooks/use-update-business-trip-car-rental-expense.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportCarRentalRowFields on BusinessTripCarRentalExpense {
    id
    payedByEmployee
    ...BusinessTripReportCoreExpenseRowFields
    days
    isFuelExpense
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportCarRentalRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const CarRentalRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const carRentalExpense = getFragmentData(BusinessTripReportCarRentalRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripCarRentalExpenseInput>({
    defaultValues: {
      id: carRentalExpense.id,
      businessTripId,
    },
  });

  const { updateBusinessTripCarRentalExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripCarRentalExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripCarRentalExpenseInput> = data => {
    updateBusinessTripCarRentalExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={carRentalExpense.id}>
      <CoreExpenseRow
        data={carRentalExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${carRentalExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2 justify-center">
            {carRentalExpense.isFuelExpense !== true &&
              (isEditMode ? (
                <Controller
                  name="days"
                  control={control}
                  defaultValue={carRentalExpense.days}
                  render={({ field, fieldState }): ReactElement => (
                    <NumberInput
                      {...field}
                      value={field.value ?? undefined}
                      form={`form ${carRentalExpense.id}`}
                      hideControls
                      precision={2}
                      removeTrailingZeros
                      error={fieldState.error?.message}
                      label="Rent Days"
                    />
                  )}
                />
              ) : (
                <Text c={carRentalExpense.days ? undefined : 'red'}>
                  {carRentalExpense.days ?? 'Missing'}
                </Text>
              ))}
          </div>
        </form>
      </td>
      <td>
        {isEditMode ? (
          <Controller
            name="isFuelExpense"
            control={control}
            defaultValue={carRentalExpense.isFuelExpense}
            render={({ field: { value, ...field }, fieldState }): ReactElement => (
              <Switch
                {...field}
                form={`form ${carRentalExpense.id}`}
                checked={value === true}
                error={fieldState.error?.message}
                label="Is Fuel Expense"
              />
            )}
          />
        ) : carRentalExpense.isFuelExpense === true ? (
          <Fuel />
        ) : (
          <Car />
        )}
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
              form={`form ${carRentalExpense.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={carRentalExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense
          businessTripExpenseId={carRentalExpense.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
