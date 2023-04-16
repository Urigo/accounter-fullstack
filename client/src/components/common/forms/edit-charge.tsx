import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Select, Switch } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  // BeneficiariesInput, CurrencyInput,
  SimpleGrid, // TagsInput,
  TextInput,
} from '..';
import { FragmentType, getFragmentData } from '../../../gql';
import {
  AllFinancialEntitiesDocument, // Currency,
  EditChargeFieldsFragmentDoc,
  UpdateChargeInput, // UpdateTransactionInput,
} from '../../../gql/graphql';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';

// import { useUpdateTransaction } from '../../../hooks/use-update-transaction';

/* GraphQL */ `
  fragment EditChargeFields on Charge {
    id
    counterparty {
      id
      name
    }
    financialEntity {
      id
      name
    }
    property
    conversion
    userDescription
  }
`;

type Props = {
  chargeProps: FragmentType<typeof EditChargeFieldsFragmentDoc>;
  onAccept?: () => void;
  onCancel?: () => void;
};

export const EditCharge = ({ chargeProps, onAccept, onCancel }: Props) => {
  const charge = getFragmentData(EditChargeFieldsFragmentDoc, chargeProps);
  const useFormManager = useForm<UpdateChargeInput>({
    defaultValues: { ...charge },
  });
  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const {
    control: chargeControl,
    handleSubmit: handleChargeSubmit,
    formState: { dirtyFields: dirtyChargeFields },
  } = useFormManager;

  // const transaction = charge.transactions[0];

  // const {
  //   control: transactionControl,
  //   handleSubmit: handleTransactionSubmit,
  //   formState: { dirtyFields: dirtyTransactionFields },
  // } = useForm<UpdateTransactionInput>({ defaultValues: transaction });

  const { updateCharge, fetching: isChargeLoading } = useUpdateCharge();
  // const { updateTransaction, fetching: isTransactionLoading } = useUpdateTransaction();

  const onChargeSubmit: SubmitHandler<UpdateChargeInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyChargeFields as MakeBoolean<typeof data>);
    // handleTransactionSubmit(onTransactionSubmit)();
    if (onAccept) {
      onAccept();
    }
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateCharge({
        chargeId: charge.id,
        fields: dataToUpdate,
      });
    }
  };

  // const onTransactionSubmit: SubmitHandler<UpdateTransactionInput> = data => {
  //   const dataToUpdate = relevantDataPicker(
  //     data,
  //     dirtyTransactionFields as MakeBoolean<typeof data>,
  //   );
  //   if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
  //     updateTransaction({
  //       transactionId: transaction.id,
  //       fields: dataToUpdate,
  //     });
  //   }
  //   if (onAccept) {
  //     onAccept();
  //   }
  // };

  const [{ data, fetching, error: financialEntitiesError }] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [financialEntitiesError]);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (data?.allFinancialEntities.length) {
      setFinancialEntities(
        data.allFinancialEntities
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [data, setFinancialEntities]);

  return (
    <form onSubmit={handleChargeSubmit(onChargeSubmit)}>
      <div className="flex-row px-10 h-max justify-start block">
        <SimpleGrid cols={3}>
          <Controller
            name="userDescription"
            control={chargeControl}
            defaultValue={charge.userDescription}
            rules={{
              required: 'Required',
              minLength: { value: 2, message: 'Must be at least 2 characters' },
            }}
            render={({ field: { value, ...field }, fieldState }) => (
              <TextInput
                {...field}
                value={value ?? undefined}
                error={fieldState.error?.message}
                label="Description"
              />
            )}
          />
          <Controller
            name="counterpartyId"
            control={chargeControl}
            defaultValue={charge.counterparty?.id}
            rules={{
              required: 'Required',
              minLength: { value: 2, message: 'Minimum 2 characters' },
            }}
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={financialEntities}
                value={field.value}
                disabled={fetching}
                label="Counterparty"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="ownerId"
            control={chargeControl}
            defaultValue={charge.financialEntity?.id}
            rules={{
              required: 'Required',
              minLength: { value: 2, message: 'Minimum 2 characters' },
            }}
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={financialEntities}
                value={field.value}
                disabled={fetching}
                label="Owner"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
              />
            )}
          />
          {/* <Controller
            name="totalAmount.raw"
            control={chargeControl}
            defaultValue={charge.totalAmount?.raw}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <Controller
                name="totalAmount.currency"
                control={chargeControl}
                defaultValue={charge.totalAmount?.currency ?? Currency.Ils}
                render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                  <CurrencyInput
                    {...amountField}
                    value={amountField.value ?? undefined}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                    label="Total Amount"
                    currencyCodeProps={{ ...currencyCodeField, label: 'Currency' }}
                  />
                )}
              />
            )}
          />
          <Controller
            name="vat"
            control={chargeControl}
            defaultValue={charge.vat?.raw}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <Controller
                name="totalAmount.currency"
                control={chargeControl}
                defaultValue={charge.totalAmount?.currency ?? Currency.Ils}
                render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                  <CurrencyInput
                    {...amountField}
                    value={amountField.value ?? undefined}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                    label="Vat"
                    currencyCodeProps={{ ...currencyCodeField, label: 'Currency', disabled: true }}
                  />
                )}
              />
            )}
          /> */}
          <Controller
            name="isProperty"
            control={chargeControl}
            defaultValue={charge.property}
            render={({ field: { value, ...field } }) => {
              return <Switch {...field} checked={value === true} label="Is Property" />;
            }}
          />
          <Controller
            name="isConversion"
            control={chargeControl}
            defaultValue={charge.property}
            render={({ field: { value, ...field } }) => {
              return <Switch {...field} checked={value === true} label="Is Conversion" />;
            }}
          />
          {/* <TagsInput formManager={useFormManager} />
          <BeneficiariesInput label="Beneficiaries" formManager={useFormManager} /> */}
        </SimpleGrid>
      </div>
      <div className="mt-10 mb-5 flex justify-center gap-5">
        <button
          type="submit"
          onClick={() => handleChargeSubmit(onChargeSubmit)}
          className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          disabled={
            isChargeLoading ||
            // isTransactionLoading ||
            Object.keys(dirtyChargeFields).length === 0
            //  + Object.keys(dirtyTransactionFields).length
          }
        >
          Accept
        </button>
        <button
          type="button"
          className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
