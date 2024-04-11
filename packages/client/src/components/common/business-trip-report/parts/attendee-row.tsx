import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, TextInput, Tooltip } from '@mantine/core';
import {
  BusinessTripAttendeeUpdateInput,
  BusinessTripReportAttendeeRowFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/consts.js';
import { useUpdateBusinessTripAttendee } from '../../../../hooks/use-update-business-trip-attendee.js';
import { DeleteAttendee } from '../buttons/delete-attendee.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAttendeeRowFields on BusinessTripAttendee {
    id
    name
    arrivalDate
    departureDate
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAttendeeRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange?: () => void;
}

export const AttendeeRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const attendee = getFragmentData(BusinessTripReportAttendeeRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

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
      close();
    });
  };

  return (
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
                <TextInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Arrival"
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
              <TextInput
                form={`form ${attendee.id}`}
                {...field}
                value={field.value ?? undefined}
                error={fieldState.error?.message}
                label="Departure"
              />
            )}
          />
        ) : (
          attendee.departureDate
        )}
      </td>
      <td className="flex items-center gap-2">
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
            <ActionIcon type="submit" form={`form ${attendee.id}`} variant="default" size={30}>
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteAttendee
          businessTripId={businessTripId}
          attendeeId={attendee.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
