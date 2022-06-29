import { ActionIcon } from '@mantine/core';
import { useEffect } from 'react';
import { Controller, useFieldArray, UseFormReturn } from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';

import { UpdateChargeInput } from '../../../__generated__/types';

type Props = {
  label?: string;
  formManager: UseFormReturn<UpdateChargeInput, object>;
};

export function BeneficiariesInput({ label, formManager }: Props) {
  const {
    control,
    formState: { errors },
    setError,
    clearErrors,
    watch,
  } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'beneficiaries',
  });

  const sum = watch('beneficiaries')
    ?.map(f => Number(f.percentage))
    .reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (setError && clearErrors) {
      if (sum === 100) {
        clearErrors('beneficiaries');
      } else {
        setError(
          'beneficiaries',
          sum === 100
            ? { type: undefined, message: undefined }
            : { type: 'custom', message: 'Sum of percentages must be 100' }
        );
      }
    }
  }, [sum, setError, clearErrors]);

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="h-full flex flex-col relative overflow-hidden">
        {fields?.map((beneficiery, index) => (
          <div key={beneficiery.id} className="flex items-center gap-2 text-gray-600 mb-2">
            <div className="mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`beneficiaries.${index}.counterparty.name`}
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <input
                    type="text"
                    {...field}
                    className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-${
                      fieldState.error ? 'red' : 'gray'
                    }-300 rounded-md`}
                  />
                )}
              />
            </div>
            <p>:</p>
            <div className="mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`beneficiaries.${index}.percentage`}
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <>
                    <style>
                      {`/* Chrome, Safari, Edge, Opera */
                        input::-webkit-outer-spin-button,
                        input::-webkit-inner-spin-button {
                          -webkit-appearance: none;
                          margin: 0;
                        }

                        /* Firefox */
                        input[type=number] {
                          -moz-appearance: textfield;
                        }
                      `}
                    </style>
                    {fieldState.error?.message}
                    <input
                      type="number"
                      // defaultValue={defaultValue?.[index].percentage}
                      {...field}
                      className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-${
                        fieldState.error ? 'red' : 'gray'
                      }-300 rounded-md`}
                    />
                    <p className="absolute inset-y-0 right-0 flex items-center">%</p>
                  </>
                )}
              />
            </div>
            <ActionIcon variant="hover">
              <TrashX size={20} onClick={() => remove(index)} />
            </ActionIcon>
          </div>
        ))}
      </div>

      <ActionIcon variant="hover">
        <PlaylistAdd size={20} onClick={() => append({ percentage: 0, counterparty: { name: '' } })} />
      </ActionIcon>
      {errors.beneficiaries?.message && <p className="text-red-500 text-xs italic">{errors.beneficiaries.message}</p>}
    </div>
  );
}
