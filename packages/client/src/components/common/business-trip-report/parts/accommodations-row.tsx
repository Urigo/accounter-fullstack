import { useState, type ReactElement } from 'react';
import { Check, Edit } from 'lucide-react';
import { useForm, type Control, type SubmitHandler } from 'react-hook-form';
import {
  BusinessTripReportAccommodationsRowFieldsFragmentDoc,
  type UpdateBusinessTripAccommodationsExpenseInput,
  type UpdateBusinessTripFlightsExpenseInput,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { useUpdateBusinessTripAccommodationsExpense } from '../../../../hooks/use-update-business-trip-accommodations-expense.js';
import { Button } from '../../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import { NumberInput, Tooltip } from '../../index.js';
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
    country {
      id
      name
    }
    nightsCount
    attendeesStay {
      id
      attendee {
        id
        name
      }
      nightsCount
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAccommodationsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange?: () => void;
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
        control={control as unknown as Control<UpdateBusinessTripFlightsExpenseInput, unknown>}
        businessTripId={businessTripId}
      />

      <td>
        <Form {...formManager}>
          <form id={`form ${accommodationExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
            {isEditMode ? (
              <FormField
                name="country"
                control={control}
                defaultValue={accommodationExpense.country?.id ?? undefined}
                render={({ field }) => (
                  // TODO: replace with country select
                  <FormItem>
                    <FormControl>
                      <Input
                        form={`form ${accommodationExpense.id}`}
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className={accommodationExpense.country ? undefined : 'text-red-500'}>
                {accommodationExpense.country?.name ?? 'Missing'}
              </div>
            )}
          </form>
        </Form>
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode ? (
            <Form {...formManager}>
              <FormField
                name="nightsCount"
                control={control}
                defaultValue={accommodationExpense.nightsCount}
                render={({ field }): ReactElement => (
                  <FormItem>
                    <FormControl>
                      <NumberInput
                        {...field}
                        value={field.value ?? undefined}
                        form={`form ${accommodationExpense.id}`}
                        hideControls
                        decimalScale={0}
                        thousandSeparator=","
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Form>
          ) : (
            <div className={accommodationExpense.nightsCount ? undefined : 'text-red-500'}>
              {accommodationExpense.nightsCount ?? 'Missing'}
            </div>
          )}
        </div>
      </td>
      <td>
        {isEditMode ? (
          <Form {...formManager}>
            <AttendeesStayInput
              formManager={formManager}
              attendeesStayPath="attendeesStay"
              businessTripId={businessTripId}
            />
          </Form>
        ) : (
          <ul className="list-disc list-inside">
            {accommodationExpense.attendeesStay?.length ? (
              accommodationExpense.attendeesStay.map(attendeeStay => (
                <li key={attendeeStay.id}>
                  {attendeeStay.attendee.name} ({attendeeStay.nightsCount})
                </li>
              ))
            ) : (
              <li className="list-none text-red-500 text-sm">Missing</li>
            )}
          </ul>
        )}
      </td>
      <td>
        {onChange && (
          <>
            <Tooltip content="Edit">
              <Button
                disabled={updatingInProcess}
                variant={isEditMode ? 'default' : 'outline'}
                size="icon"
                className="size-7.5"
                onClick={(event): void => {
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
                  form={`form ${accommodationExpense.id}`}
                  variant="outline"
                  size="icon"
                  className="size-7.5 text-green-500"
                >
                  <Check className="size-5" />
                </Button>
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
          </>
        )}
      </td>
    </tr>
  );
};
