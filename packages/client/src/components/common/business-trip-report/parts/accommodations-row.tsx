import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, NumberInput, Text, TextInput, Tooltip } from '@mantine/core';
import { UpdateBusinessTripAccommodationsTransactionInput } from '../../../../gql/graphql.js';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { useUpdateBusinessTripAccommodationsTransaction } from '../../../../hooks/use-update-business-trip-accommodations-transaction.js';
import { DeleteBusinessTripTransaction } from '../buttons/delete-business-trip-transaction.js';
import { CoreTransactionRow } from './core-transaction-row.js';

export const BusinessTripReportAccommodationsRowFieldsFragmentDoc = graphql(`
  fragment BusinessTripReportAccommodationsRowFields on BusinessTripAccommodationTransaction {
    id
    ...BusinessTripReportCoreTransactionRowFields
    payedByEmployee
    country
    nightsCount
  }
`);

interface Props {
  data: FragmentOf<typeof BusinessTripReportAccommodationsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const AccommodationsRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const accommodationTransaction = readFragment(
    BusinessTripReportAccommodationsRowFieldsFragmentDoc,
    data,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripAccommodationsTransactionInput>({
    defaultValues: {
      id: accommodationTransaction.id,
      businessTripId,
    },
  });

  const { updateBusinessTripAccommodationsTransaction, fetching: updatingInProcess } =
    useUpdateBusinessTripAccommodationsTransaction();

  const onSubmit: SubmitHandler<UpdateBusinessTripAccommodationsTransactionInput> = data => {
    updateBusinessTripAccommodationsTransaction({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
      close();
    });
  };

  return (
    <tr key={accommodationTransaction.id}>
      <CoreTransactionRow
        data={accommodationTransaction}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${accommodationTransaction.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="country"
              control={control}
              defaultValue={accommodationTransaction.country}
              render={({ field, fieldState }): ReactElement => (
                <TextInput
                  form={`form ${accommodationTransaction.id}`}
                  data-autofocus={accommodationTransaction.payedByEmployee ? undefined : true}
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Country"
                />
              )}
            />
          ) : (
            <Text c={accommodationTransaction.country ? undefined : 'red'}>
              {accommodationTransaction.country ?? 'Missing'}
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
              defaultValue={accommodationTransaction.nightsCount}
              render={({ field, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  value={field.value ?? undefined}
                  form={`form ${accommodationTransaction.id}`}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  error={fieldState.error?.message}
                  label="Nights Count"
                />
              )}
            />
          ) : (
            <Text c={accommodationTransaction.nightsCount ? undefined : 'red'}>
              {accommodationTransaction.nightsCount ?? 'Missing'}
            </Text>
          )}
        </div>
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
              form={`form ${accommodationTransaction.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteBusinessTripTransaction
          businessTripTransactionId={accommodationTransaction.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
