import { Switch } from '@mantine/core';
import gql from 'graphql-tag';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import {
  Currency,
  EditChargeFieldsFragment,
  UpdateChargeInput,
  UpdateTransactionInput,
} from '../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../helpers';
import { useUpdateCharge } from '../../hooks/use-update-charge';
import { useUpdateTransaction } from '../../hooks/use-update-transaction';
import { BeneficiariesInput, CurrencyInput, TagsInput, TextInput } from '../common/inputs';

gql`
  fragment EditChargeFields on Charge {
    id
    counterparty {
      name
    }
    beneficiaries {
      percentage
      counterparty {
        name
      }
    }
    property
    tags {
      name
    }
    vat {
      raw
      currency
    }
    withholdingTax {
      raw
      currency
    }
    transactions {
      id
      userNote
    }
  }
`;

type Props = {
  charge: EditChargeFieldsFragment;
  onAccept?: () => void;
  onCancel?: () => void;
};

export const EditCharge = ({ charge, onAccept, onCancel }: Props) => {
  const useFormManager = useForm<UpdateChargeInput>({ defaultValues: charge });
  const {
    control: chargeControl,
    handleSubmit: handleChargeSubmit,
    formState: { dirtyFields: dirtyChargeFields },
  } = useFormManager;

  const transaction = charge.transactions[0];

  const {
    control: transactionControl,
    handleSubmit: handleTransactionSubmit,
    formState: { dirtyFields: dirtyTransactionFields },
  } = useForm<UpdateTransactionInput>({ defaultValues: transaction });

  const { mutate: mutateCharge, isLoading: isChargeLoading } = useUpdateCharge();
  const { mutate: mutateTransaction, isLoading: isTransactionLoading } = useUpdateTransaction();

  const onChargeSubmit: SubmitHandler<UpdateChargeInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyChargeFields as MakeBoolean<typeof data>);
    handleTransactionSubmit(onTransactionSubmit)();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      mutateCharge({
        chargeId: charge.id,
        fields: dataToUpdate,
      });
    }
  };

  const onTransactionSubmit: SubmitHandler<UpdateTransactionInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyTransactionFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      mutateTransaction({
        transactionId: transaction.id,
        fields: dataToUpdate,
      });
    }
    if (onAccept) {
      onAccept();
    }
  };

  return (
    <form className="text-gray-600 body-font" onSubmit={handleChargeSubmit(onChargeSubmit)}>
      <div className="container px-5 py-24 mx-auto">
        <div className="text-center mb-20">
          <h1 className="sm:text-3xl text-2xl font-medium text-center title-font text-gray-900 mb-4">Edit Charge</h1>
          <p>ID: {charge.id}</p>
        </div>
        <div className="flex flex-wrap lg:w-4/5 sm:mx-auto sm:mb-2 -mx-2">
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="userNote"
                control={transactionControl}
                defaultValue={transaction.userNote}
                rules={{ required: 'Required', minLength: { value: 2, message: 'Must be at least 2 characters' } }}
                render={({ field: { value, ...field }, fieldState }) => (
                  <TextInput
                    {...field}
                    value={value ?? undefined}
                    error={fieldState.error?.message}
                    label="Description"
                  />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="counterparty.name"
                control={chargeControl}
                defaultValue={charge.counterparty?.name}
                rules={{ required: 'Required', minLength: { value: 2, message: 'Minimum 2 characters' } }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} label="Counterparty" />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <BeneficiariesInput label="Beneficiaries" formManager={useFormManager} />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <TagsInput formManager={useFormManager} />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="withholdingTax.raw"
                control={chargeControl}
                defaultValue={charge.withholdingTax?.raw}
                render={({ field: amountField, fieldState: amountFieldState }) => (
                  <Controller
                    name="withholdingTax.currency"
                    control={chargeControl}
                    defaultValue={charge.withholdingTax?.currency ?? Currency.Ils}
                    render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                      <CurrencyInput
                        {...amountField}
                        error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                        label="withholding Tax"
                        currencyCodeProps={{ ...currencyCodeField, label: 'Currency', disabled: true }}
                      />
                    )}
                  />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="isProperty"
                control={chargeControl}
                defaultValue={charge.property}
                render={({ field: { value, ...field } }) => {
                  return <Switch {...field} checked={value === true} label="Is Property" />;
                }}
              />
            </div>
          </div>
        </div>
        <div className="container flex justify-center gap-20">
          <button
            type="submit"
            onClick={() => handleChargeSubmit(onChargeSubmit)}
            className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={
              isChargeLoading ||
              isTransactionLoading ||
              Object.keys(dirtyChargeFields).length + Object.keys(dirtyTransactionFields).length === 0
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
      </div>
    </form>
  );
};
