import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, List, MultiSelect, Select, Text, Tooltip } from '@mantine/core';
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
import { FlightPathInput } from './flight-path-input.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsRowFields on BusinessTripFlightExpense {
    id
    payedByEmployee
    ...BusinessTripReportCoreExpenseRowFields
    path
    class
    attendees {
      id
      name
    }
  }
`;

const flightClasses = Object.entries(FlightClass).map(([key, value]) => ({
  value,
  label: key,
}));

interface Props {
  data: FragmentType<typeof BusinessTripReportFlightsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange?: () => void;
  attendees: { id: string; name: string }[];
}

export const FlightsRow = ({ data, businessTripId, onChange, attendees }: Props): ReactElement => {
  const flightExpense = getFragmentData(BusinessTripReportFlightsRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const formManager = useForm<UpdateBusinessTripFlightsExpenseInput>({
    defaultValues: {
      id: flightExpense.id,
      businessTripId,
      attendeeIds: flightExpense.attendees?.map(attendee => attendee.id) ?? [],
      path: flightExpense.path ?? [],
    },
  });
  const { control, handleSubmit } = formManager;

  const { updateBusinessTripFlightsExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripFlightsExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripFlightsExpenseInput> = data => {
    updateBusinessTripFlightsExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  const attendeesData = attendees.map(attendee => ({
    value: attendee.id,
    label: attendee.name,
  }));

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
              <FlightPathInput
                formManager={formManager}
                flightPathPath="path"
                flightPathData={flightExpense.path ?? undefined}
              />
            ) : (
              <div className="flex gap-2 items-center">
                {flightExpense.path?.length ? (
                  flightExpense.path.map((destination, i) => (
                    <>
                      <Text fw={700} key={i}>
                        {destination}
                      </Text>
                      {i < flightExpense.path!.length - 1 &&
                        (destination === flightExpense.path![i + 1] ? ' | ' : ' → ')}
                    </>
                  ))
                ) : (
                  <Text fw={700} className="flex gap-2 items-center" c="red">
                    Missing
                  </Text>
                )}
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
        {isEditMode ? (
          <Controller
            name="attendeeIds"
            control={control}
            defaultValue={flightExpense.attendees?.map(attendee => attendee.id) ?? undefined}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                form={`form ${flightExpense.id}`}
                data={attendeesData}
                value={field.value ?? []}
                label="Attendees"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />
        ) : (
          <List listStyleType="disc">
            {flightExpense.attendees?.length ? (
              flightExpense.attendees.map(attendee => (
                <List.Item key={attendee.id}>{attendee.name}</List.Item>
              ))
            ) : (
              <Text c="red" fz="sm">
                Missing
              </Text>
            )}
          </List>
        )}
      </td>
      <td>
        {onChange && (
          <>
            <Tooltip label="Edit">
              <ActionIcon
                loading={updatingInProcess}
                variant={isEditMode ? 'filled' : 'default'}
                onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
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
                  form={`form ${flightExpense.id}`}
                  variant="default"
                  size={30}
                >
                  <Check size={20} color="green" />
                </ActionIcon>
              </Tooltip>
            )}

            <CategorizeIntoExistingExpense
              businessTripExpenseId={flightExpense.id}
              businessTripId={businessTripId}
              onChange={onChange}
            />

            <DeleteBusinessTripExpense
              businessTripExpenseId={flightExpense.id}
              onDelete={onChange}
            />
          </>
        )}
      </td>
    </tr>
  );
};
