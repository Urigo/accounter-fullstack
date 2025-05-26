import { ReactElement } from 'react';
import {
  ArrayPath,
  FieldArray,
  FieldValues,
  Path,
  useFieldArray,
  UseFormReturn,
} from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { dirtyFieldMarker } from '../../../../helpers/index.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import { NumberInput } from '../../index.js';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  irsCodesPath: Path<T>;
  highlightIfDirty?: boolean;
};

export function IrsCodesInput<T extends FieldValues>({
  formManager,
  irsCodesPath,
  highlightIfDirty,
}: Props<T>): ReactElement {
  const { control, watch, trigger } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: irsCodesPath as ArrayPath<T>,
  });

  const watchFieldArray = watch(irsCodesPath);
  const controlledFields = fields.map((field, index) => {
    return {
      ...field,
      ...watchFieldArray[index],
    };
  });

  return (
    <div>
      <Label className="mantine-InputWrapper-label mantine-Select-label">IRS Codes</Label>
      <div className="h-full flex flex-col overflow-hidden">
        {controlledFields?.map((record, index) => (
          <div key={record.id} className="flex items-end gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <FormField
                name={`${irsCodesPath}.${index}` as Path<T>}
                control={control}
                rules={{
                  validate: {
                    range: value =>
                      (Number(value) > 1 && Number(value) <= 9999) ||
                      'Code must be between 1 and 9999',
                    integer: value => Number.isInteger(Number(value)) || 'Code must be an integer',
                    unique: _value =>
                      !watchFieldArray ||
                      new Set(watchFieldArray.map(Number)).size === watchFieldArray.length ||
                      'Duplicated codes found',
                  },
                }}
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <NumberInput
                        {...field}
                        value={field.value ?? undefined}
                        hideControls
                        decimalScale={0}
                        thousandSeparator=""
                        className={highlightIfDirty ? dirtyFieldMarker(fieldState) : undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mb-2 size-7.5"
              onClick={(): void => {
                remove(index);
                trigger(irsCodesPath);
              }}
            >
              <TrashX className="size-5" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7.5"
          onClick={(): void => {
            append(undefined as FieldArray<T, ArrayPath<T>>);
            trigger(irsCodesPath);
          }}
        >
          <PlaylistAdd className="size-5" />
        </Button>
      </div>
    </div>
  );
}
