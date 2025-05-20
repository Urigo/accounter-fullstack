import { ReactElement, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { Card, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  BusinessTripAttendeeUpdateInput,
  BusinessTripReportAttendeeRowFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/consts.js';
import { useUpdateBusinessTripAttendee } from '../../../../hooks/use-update-business-trip-attendee.js';
import { Button } from '../../../ui/button.js';
import { ToggleExpansionButton } from '../../index.js';
import { DeleteAttendee } from '../buttons/delete-attendee.jsx';
import { AccommodationsTable } from './accommodations-table.js';
import { FlightsTable } from './flights-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAttendeeRowFields on BusinessTripAttendee {
    id
    name
    arrivalDate
    departureDate
    flights {
      id
      ...BusinessTripReportFlightsTableFields
    }
    accommodations {
      id
      ...BusinessTripReportAccommodationsTableFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAttendeeRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const AttendeeRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const attendee = getFragmentData(BusinessTripReportAttendeeRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isExtended, setIsExtended] = useState(false);

  const { control, handleSubmit } = useForm<BusinessTripAttendeeUpdateInput>({
    defaultValues: {
      businessTripId,
      attendeeId: attendee.id,
      arrivalDate: attendee.arrivalDate,
      departureDate: attendee.departureDate,
    },
  });

  const { updateBusinessTripAttendee, fetching: updatingInProcess } =
    useUpdateBusinessTripAttendee();

  const onSubmit: SubmitHandler<BusinessTripAttendeeUpdateInput> = data => {
    updateBusinessTripAttendee({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <>
      <tr key={attendee.id}>
        <td>{attendee.name}</td>
        <td>
          {isEditMode ? (
            <form id={`form ${attendee.id}`} onSubmit={handleSubmit(onSubmit)}>
              <Controller
                name="arrivalDate"
                control={control}
                defaultValue={attendee.arrivalDate}
                rules={{
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <DatePickerInput
                    {...field}
                    onChange={(date?: Date | string | null): void => {
                      const newDate = date
                        ? typeof date === 'string'
                          ? date
                          : format(date, 'yyyy-MM-dd')
                        : undefined;
                      if (newDate !== field.value) field.onChange(newDate);
                    }}
                    data-autofocus
                    value={field.value ? new Date(field.value) : undefined}
                    error={fieldState.error?.message}
                    label="Arrival"
                    popoverProps={{ withinPortal: true }}
                  />
                )}
              />
            </form>
          ) : (
            attendee.arrivalDate
          )}
        </td>
        <td>
          {isEditMode ? (
            <Controller
              name="departureDate"
              control={control}
              defaultValue={attendee.departureDate}
              rules={{
                pattern: {
                  value: TIMELESS_DATE_REGEX,
                  message: 'Date must be im format yyyy-mm-dd',
                },
              }}
              render={({ field, fieldState }): ReactElement => (
                <DatePickerInput
                  {...field}
                  onChange={(date?: Date | string | null): void => {
                    const newDate = date
                      ? typeof date === 'string'
                        ? date
                        : format(date, 'yyyy-MM-dd')
                      : undefined;
                    if (newDate !== field.value) field.onChange(newDate);
                  }}
                  value={field.value ? new Date(field.value) : undefined}
                  error={fieldState.error?.message}
                  label="Departure"
                  popoverProps={{ withinPortal: true }}
                />
              )}
            />
          ) : (
            attendee.departureDate
          )}
        </td>
        <td className="flex items-center gap-2">
          <Tooltip label="Edit">
            <Button
              loading={updatingInProcess}
              variant={isEditMode ? 'default' : 'outline'}
              size="icon"
              className="size-7.5"
              onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
                event.stopPropagation();
                setIsEditMode(curr => !curr);
              }}
            >
              <Edit className="size-5" />
            </Button>
          </Tooltip>
          {isEditMode && (
            <Tooltip label="Confirm Changes">
              <Button
                type="submit"
                form={`form ${attendee.id}`}
                variant="outline"
                size="icon"
                className="size-7.5 text-green-500"
              >
                <Check className="size-5" />
              </Button>
            </Tooltip>
          )}

          <DeleteAttendee
            businessTripId={businessTripId}
            attendeeId={attendee.id}
            onDelete={onChange}
          />

          <ToggleExpansionButton toggleExpansion={setIsExtended} isExpanded={isExtended} />
        </td>
      </tr>
      {isExtended && (
        <tr key={`${attendee.id}-expension`}>
          <td colSpan={4}>
            <Card shadow="sm" withBorder>
              <div className="flex flex-col gap-2">
                {attendee.flights && (
                  <>
                    <div>Flights:</div>
                    <FlightsTable
                      businessTripId={businessTripId}
                      attendees={[]}
                      expenses={attendee.flights}
                    />
                  </>
                )}
                {attendee.accommodations && (
                  <>
                    <div>Accommodations:</div>
                    <AccommodationsTable
                      businessTripId={businessTripId}
                      expenses={attendee.accommodations}
                    />
                  </>
                )}
              </div>
            </Card>
          </td>
        </tr>
      )}
    </>
  );
};
