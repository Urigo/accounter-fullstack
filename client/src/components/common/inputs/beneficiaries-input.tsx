import { useEffect } from 'react';
import { ActionIcon } from '@mantine/core';
import { Controller, useFieldArray, UseFormReturn } from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { UpdateChargeInput } from '../../../__generated__/types';
import { PercentageInput } from './percentage-input';
import { TextInput } from './text-input';

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
            : { type: 'custom', message: 'Sum of percentages must be 100' },
        );
      }
    }
  }, [sum, setError, clearErrors]);

  return (
    <div>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="h-full flex flex-col relative overflow-hidden">
        {fields?.map((beneficiery, index) => (
          <div key={beneficiery.id} className="flex items-center gap-2 text-gray-600 mb-2">
            <div className="mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`beneficiaries.${index}.counterparty.name`}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} />
                )}
              />
            </div>
            <p>:</p>
            <div className="mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`beneficiaries.${index}.percentage`}
                rules={{ required: 'Required', max: 100, min: 0 }}
                render={({ field, fieldState }) => (
                  <PercentageInput
                    {...field}
                    error={fieldState.error?.message}
                    isDirty={fieldState.isDirty}
                  />
                )}
              />
            </div>
            <ActionIcon>
              <TrashX size={20} onClick={() => remove(index)} />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd
            size={20}
            onClick={() => append({ percentage: 0, counterparty: { name: '' } })}
          />
        </ActionIcon>
        {errors.beneficiaries?.message && (
          <p className="text-red-500 text-xs italic">{errors.beneficiaries.message}</p>
        )}
      </div>
    </div>
  );
}
