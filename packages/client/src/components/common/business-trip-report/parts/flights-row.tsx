import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, Select, Text, TextInput, Tooltip } from '@mantine/core';
import {
  BusinessTripReportFlightsRowFieldsFragmentDoc,
  FlightClass,
  UpdateBusinessTripFlightsExpenseInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripFlightsExpense } from '../../../../hooks/use-update-business-trip-flights-expense.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsRowFields on BusinessTripFlightExpense {
    id
    payedByEmployee
    ...BusinessTripReportCoreExpenseRowFields
    origin
    destination
    class
  }
`;

const flightClasses = Object.entries(FlightClass).map(([key, value]) => ({
  value,
  label: key,
}));

interface Props {
  data: FragmentType<typeof BusinessTripReportFlightsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const FlightsRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const flightExpense = getFragmentData(BusinessTripReportFlightsRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripFlightsExpenseInput>({
    defaultValues: {
      id: flightExpense.id,
      businessTripId,
    },
  });

  const { updateBusinessTripFlightsExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripFlightsExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripFlightsExpenseInput> = data => {
    updateBusinessTripFlightsExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={flightExpense.id}>
      <CoreExpenseRow
        data={flightExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${flightExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2 justify-center">
            {isEditMode ? (
              <div className="flex gap-2 items-center">
                <Controller
                  name="origin"
                  control={control}
                  defaultValue={flightExpense.origin}
                  render={({ field, fieldState }): ReactElement => (
                    <TextInput
                      data-autofocus={flightExpense.payedByEmployee ? undefined : true}
                      form={`form ${flightExpense.id}`}
                      {...field}
                      value={field.value ?? undefined}
                      error={fieldState.error?.message}
                      label="Origin"
                    />
                  )}
                />
                {' → '}
                <Controller
                  name="destination"
                  control={control}
                  defaultValue={flightExpense.destination}
                  render={({ field, fieldState }): ReactElement => (
                    <TextInput
                      form={`form ${flightExpense.id}`}
                      {...field}
                      value={field.value ?? undefined}
                      error={fieldState.error?.message}
                      label="Destination"
                    />
                  )}
                />
              </div>
            ) : (
              <div>
                <Text fw={700} className="flex gap-2 items-center">
                  <Text c={flightExpense.origin ? undefined : 'red'}>
                    {flightExpense.origin ?? 'Missing'}
                  </Text>
                  {' → '}
                  <Text c={flightExpense.destination ? undefined : 'red'}>
                    {flightExpense.destination ?? 'Missing'}
                  </Text>
                </Text>
              </div>
            )}
            {isEditMode ? (
              <Controller
                name="flightClass"
                control={control}
                defaultValue={(flightExpense.class as FlightClass | null | undefined) ?? undefined}
                render={({ field, fieldState }): ReactElement => (
                  <Select
                    form={`form ${flightExpense.id}`}
                    data-autofocus
                    {...field}
                    data={flightClasses}
                    value={field.value}
                    label="Flight Class"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                    withinPortal
                  />
                )}
              />
            ) : (
              <Text
                c={flightExpense.class ? undefined : 'red'}
                fz="sm"
              >{`Class: ${flightExpense.class ?? 'Missing'}`}</Text>
            )}
          </div>
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
            <ActionIcon type="submit" form={`form ${flightExpense.id}`} variant="default" size={30}>
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={flightExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense businessTripExpenseId={flightExpense.id} onDelete={onChange} />
      </td>
    </tr>
  );
};
