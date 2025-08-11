import { useState, type ReactElement } from 'react';
import { Check, Edit } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Text, Tooltip } from '@mantine/core';
import {
  BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
  type UpdateBusinessTripTravelAndSubsistenceExpenseInput,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { useUpdateBusinessTripTravelAndSubsistenceExpense } from '../../../../hooks/use-update-business-trip-travel-and-subsistence-expense.js';
import { Button } from '../../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportTravelAndSubsistenceRowFields on BusinessTripTravelAndSubsistenceExpense {
    id
    ...BusinessTripReportCoreExpenseRowFields
    payedByEmployee
    expenseType
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const TravelAndSubsistenceRow = ({
  data,
  businessTripId,
  onChange,
}: Props): ReactElement => {
  const travelAndSubsistenceExpense = getFragmentData(
    BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
    data,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  const form = useForm<UpdateBusinessTripTravelAndSubsistenceExpenseInput>({
    defaultValues: {
      id: travelAndSubsistenceExpense.id,
      businessTripId,
    },
  });
  const { control, handleSubmit } = form;

  const { updateBusinessTripTravelAndSubsistenceExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripTravelAndSubsistenceExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripTravelAndSubsistenceExpenseInput> = data => {
    updateBusinessTripTravelAndSubsistenceExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={travelAndSubsistenceExpense.id}>
      <CoreExpenseRow
        data={travelAndSubsistenceExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <Form {...form}>
          <form id={`form ${travelAndSubsistenceExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
            {isEditMode ? (
              <FormField
                name="expenseType"
                control={control}
                defaultValue={travelAndSubsistenceExpense.expenseType}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        form={`form ${travelAndSubsistenceExpense.id}`}
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <Text c={travelAndSubsistenceExpense.expenseType ? undefined : 'red'}>
                {travelAndSubsistenceExpense.expenseType ?? 'Missing'}
              </Text>
            )}
          </form>
        </Form>
      </td>
      <td>
        <Tooltip label="Edit">
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
          <Tooltip label="Confirm Changes">
            <Button
              type="submit"
              form={`form ${travelAndSubsistenceExpense.id}`}
              variant="outline"
              size="icon"
              className="size-7.5 text-green-500"
            >
              <Check className="size-5" />
            </Button>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={travelAndSubsistenceExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense
          businessTripExpenseId={travelAndSubsistenceExpense.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
