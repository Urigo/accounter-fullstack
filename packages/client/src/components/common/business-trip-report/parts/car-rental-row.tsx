import { useState, type ReactElement } from 'react';
import { Car, Check, Edit, Fuel } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { NumberInput, Text } from '@mantine/core';
import {
  BusinessTripReportCarRentalRowFieldsFragmentDoc,
  type UpdateBusinessTripCarRentalExpenseInput,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { useUpdateBusinessTripCarRentalExpense } from '../../../../hooks/use-update-business-trip-car-rental-expense.js';
import { Button } from '../../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../../ui/form.js';
import { Switch } from '../../../ui/switch.js';
import { Tooltip } from '../../index.js';
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

  const form = useForm<UpdateBusinessTripCarRentalExpenseInput>({
    defaultValues: {
      id: carRentalExpense.id,
      businessTripId,
    },
  });
  const { control, handleSubmit } = form;

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
        <Form {...form}>
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
                        placeholder="Rent Days"
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
        </Form>
      </td>
      <td>
        {isEditMode ? (
          <Form {...form}>
            <FormField
              name="isFuelExpense"
              control={control}
              defaultValue={carRentalExpense.isFuelExpense}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Is Fuel Expense</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      form={`form ${carRentalExpense.id}`}
                      checked={field.value === true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        ) : carRentalExpense.isFuelExpense === true ? (
          <Fuel />
        ) : (
          <Car />
        )}
      </td>
      <td>
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
              form={`form ${carRentalExpense.id}`}
              variant="outline"
              size="icon"
              className="size-7.5 text-green-500"
            >
              <Check className="size-5" />
            </Button>
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
