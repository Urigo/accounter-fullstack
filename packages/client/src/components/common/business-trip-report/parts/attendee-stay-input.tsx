import { ReactElement, useEffect, useState } from 'react';
import {
  ArrayPath,
  Controller,
  FieldArray,
  FieldValues,
  Path,
  useFieldArray,
  UseFormReturn,
} from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, NumberInput, Select } from '@mantine/core';
import { AttendeesByBusinessTripDocument } from '../../../../gql/graphql.js';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  attendeesStayPath: ArrayPath<T>;
  attendeesData?: {
    value: string;
    label: string;
  }[];
  fetchingAttendees?: boolean;
  businessTripId?: string;
};

export function AttendeesStayInput<T extends FieldValues>({
  formManager,
  attendeesStayPath,
  attendeesData,
  fetchingAttendees = false,
  businessTripId,
}: Props<T>): ReactElement {
  const { control, watch, trigger } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: attendeesStayPath,
  });
  const [fetching, setFetching] = useState(fetchingAttendees);
  const [attendees, setAttendees] = useState(attendeesData ?? []);

  const watchFieldArray = watch(attendeesStayPath as Path<T>);
  const controlledFields = fields.map((field, index) => {
    return {
      ...field,
      ...watchFieldArray[index],
    };
  });

  useEffect(() => {
    if (attendeesData) {
      setAttendees(attendeesData);
    }
  }, [attendeesData]);

  useEffect(() => {
    setFetching(fetchingAttendees);
  }, [fetchingAttendees]);

  const [{ data, fetching: locallyFetchingAttendees }, fetchAttendees] = useQuery({
    query: AttendeesByBusinessTripDocument,
    pause: true,
    variables: {
      businessTripId,
    },
  });

  useEffect(() => {
    if (data?.businessTrip?.attendees.length) {
      const attendeesData =
        data.businessTrip.attendees.map(attendee => ({
          value: attendee.id,
          label: attendee.name,
        })) ?? [];

      setAttendees(attendeesData);
    }
  }, [data?.businessTrip?.attendees]);

  useEffect(() => {
    setFetching(locallyFetchingAttendees);
  }, [locallyFetchingAttendees]);

  useEffect(() => {
    if (!attendeesData && !data && !fetchingAttendees && !locallyFetchingAttendees) {
      fetchAttendees({ businessTripId });
    }
  }, [
    attendeesData,
    fetchingAttendees,
    locallyFetchingAttendees,
    fetchAttendees,
    businessTripId,
    data,
  ]);

  if (!businessTripId && !attendeesData) {
    return <div>Cannot edit attendees stay, lacking some mandatory information!</div>;
  }

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Employees Stay</span>
      <div className="h-full flex flex-col overflow-hidden">
        {controlledFields?.map((record, index) => (
          <div key={record.id} className="flex items-end gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                name={`${attendeesStayPath}.${index}.attendeeId` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                }}
                render={({ field, fieldState }): ReactElement => (
                  <Select
                    {...field}
                    disabled={fetching}
                    data={attendees}
                    value={field.value ?? undefined}
                    label="Attendee"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                    withinPortal
                    required
                  />
                )}
              />
            </div>
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`${attendeesStayPath}.${index}.nightsCount` as Path<T>}
                render={({ field, fieldState }): ReactElement => (
                  <NumberInput
                    className="w-full"
                    {...field}
                    min={0}
                    label="Nights Count"
                    value={field.value ?? undefined}
                    hideControls
                    precision={0}
                    error={fieldState.error?.message}
                    required
                    onChange={amount =>
                      field.onChange(amount && typeof amount === 'number' ? amount : undefined)
                    }
                  />
                )}
              />
            </div>
            <ActionIcon className="mb-2">
              <TrashX
                size={20}
                onClick={(): void => {
                  remove(index);
                  trigger(attendeesStayPath as Path<T>);
                }}
              />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd
            size={20}
            onClick={(): void => {
              append({} as FieldArray<T, ArrayPath<T>>);
              trigger(attendeesStayPath as Path<T>);
            }}
          />
        </ActionIcon>
      </div>
    </div>
  );
}
