import { useState, type ReactElement } from 'react';
import { Check, Edit } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Card } from '@mantine/core';
import {
  BusinessTripReportAttendeeRowFieldsFragmentDoc,
  type BusinessTripAttendeeUpdateInput,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/consts.js';
import { useUpdateBusinessTripAttendee } from '../../../../hooks/use-update-business-trip-attendee.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { ToggleExpansionButton, Tooltip } from '../../index.js';
import { DatePickerInput } from '../../inputs/date-picker-input.js';
import { DeleteAttendee } from '../buttons/delete-attendee.js';
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

  const form = useForm<BusinessTripAttendeeUpdateInput>({
    defaultValues: {
      businessTripId,
      attendeeId: attendee.id,
      arrivalDate: attendee.arrivalDate,
      departureDate: attendee.departureDate,
    },
  });
  const { control, handleSubmit } = form;

  const { updateBusinessTripAttendee, fetching: updatingInProcess } =
    useUpdateBusinessTripAttendee();

  const onSubmit: SubmitHandler<BusinessTripAttendeeUpdateInput> = data => {
    updateBusinessTripAttendee({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <Form {...form}>
      <tr key={attendee.id}>
        <td>{attendee.name}</td>
        <td>
          {isEditMode ? (
            <form id={`form ${attendee.id}`} onSubmit={handleSubmit(onSubmit)}>
              <FormField
                name="arrivalDate"
                control={control}
                defaultValue={attendee.arrivalDate}
                rules={{
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be in format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <FormItem className="h-min">
                    <FormLabel className="sr-only">Arrival</FormLabel>
                    <FormControl>
                      <DatePickerInput
                        data-autofocus
                        value={field.value ?? undefined}
                        onChange={date => {
                          if (date !== field.value) field.onChange(date);
                        }}
                        aria-invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          ) : (
            attendee.arrivalDate
          )}
        </td>
        <td>
          {isEditMode ? (
            <FormField
              name="departureDate"
              control={control}
              defaultValue={attendee.departureDate}
              rules={{
                pattern: {
                  value: TIMELESS_DATE_REGEX,
                  message: 'Date must be in format yyyy-mm-dd',
                },
              }}
              render={({ field, fieldState }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel className="sr-only">Departure</FormLabel>
                  <FormControl>
                    <DatePickerInput
                      value={field.value ?? undefined}
                      onChange={date => {
                        if (date !== field.value) field.onChange(date);
                      }}
                      aria-invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            attendee.departureDate
          )}
        </td>
        <td className="flex items-center gap-2">
          <Tooltip content="Edit">
            <Button
              disabled={updatingInProcess}
              variant={isEditMode ? 'default' : 'outline'}
              size="icon"
              className="size-7.5"
              onClick={event => {
                event.stopPropagation();
                setIsEditMode(curr => !curr);
              }}
            >
              <Edit className="size-5" />
            </Button>
          </Tooltip>
          {isEditMode && (
            <Tooltip content="Confirm Changes">
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
    </Form>
  );
};
