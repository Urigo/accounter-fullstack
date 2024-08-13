import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, List, NumberInput, Text, TextInput, Tooltip } from '@mantine/core';
import {
  BusinessTripReportAccommodationsRowFieldsFragmentDoc,
  UpdateBusinessTripAccommodationsExpenseInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateBusinessTripAccommodationsExpense } from '../../../../hooks/use-update-business-trip-accommodations-expense.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { AttendeesStayInput } from './attendee-stay-input.js';
import { CoreExpenseRow } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAccommodationsRowFields on BusinessTripAccommodationExpense {
    id
    ...BusinessTripReportCoreExpenseRowFields
    payedByEmployee
    country
    nightsCount
    attendeesStay {
      id
      attendee {
        name
      }
      nightsCount
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAccommodationsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const AccommodationsRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const accommodationExpense = getFragmentData(
    BusinessTripReportAccommodationsRowFieldsFragmentDoc,
    data,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  const formManager = useForm<UpdateBusinessTripAccommodationsExpenseInput>({
    defaultValues: {
      id: accommodationExpense.id,
      businessTripId,
      attendeesStay: accommodationExpense.attendeesStay.map(attendeeStay => ({
        attendeeId: attendeeStay.id,
        nightsCount: attendeeStay.nightsCount,
      })),
    },
  });
  const { control, handleSubmit } = formManager;

  const { updateBusinessTripAccommodationsExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripAccommodationsExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripAccommodationsExpenseInput> = data => {
    updateBusinessTripAccommodationsExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={accommodationExpense.id}>
      <CoreExpenseRow
        data={accommodationExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${accommodationExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="country"
              control={control}
              defaultValue={accommodationExpense.country}
              render={({ field, fieldState }): ReactElement => (
                <TextInput
                  form={`form ${accommodationExpense.id}`}
                  data-autofocus={accommodationExpense.payedByEmployee ? undefined : true}
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Country"
                />
              )}
            />
          ) : (
            <Text c={accommodationExpense.country ? undefined : 'red'}>
              {accommodationExpense.country ?? 'Missing'}
            </Text>
          )}
        </form>
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode ? (
            <Controller
              name="nightsCount"
              control={control}
              defaultValue={accommodationExpense.nightsCount}
              render={({ field, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  value={field.value ?? undefined}
                  form={`form ${accommodationExpense.id}`}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  error={fieldState.error?.message}
                  label="Nights Count"
                />
              )}
            />
          ) : (
            <Text c={accommodationExpense.nightsCount ? undefined : 'red'}>
              {accommodationExpense.nightsCount ?? 'Missing'}
            </Text>
          )}
        </div>
      </td>
      <td>
        {isEditMode ? (
          <AttendeesStayInput
            formManager={formManager}
            attendeesStayPath="attendeesStay"
            businessTripId={businessTripId}
          />
        ) : (
          <List listStyleType="disc">
            {accommodationExpense.attendeesStay?.length ? (
              accommodationExpense.attendeesStay.map(attendeeStay => (
                <List.Item key={attendeeStay.id}>
                  {attendeeStay.attendee.name} ({attendeeStay.nightsCount})
                </List.Item>
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
              form={`form ${accommodationExpense.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={accommodationExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense
          businessTripExpenseId={accommodationExpense.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
