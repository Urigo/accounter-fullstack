import type { ReactElement } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { useFormContext, useWatch, type Control } from 'react-hook-form';
import { cn } from '../../../lib/utils.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip.js';
import type { ChargeFilterFormValues } from './schema.js';

/**
 * Free text is modelled as two mutually exclusive fields — `freeText` (contains) and
 * `excludedFreeText` (does not contain). The toggle moves the text between them rather
 * than dropping it, mirroring the +/- flip on the multi-selects.
 */
export function FreeTextField({
  control,
}: {
  control: Control<ChargeFilterFormValues>;
}): ReactElement {
  const { setValue } = useFormContext<ChargeFilterFormValues>();
  const freeText = useWatch({ control, name: 'freeText' });
  const excludedFreeText = useWatch({ control, name: 'excludedFreeText' });
  const excluding = !!excludedFreeText;
  const activeField = excluding ? 'excludedFreeText' : 'freeText';

  function flip(): void {
    const text = excluding ? excludedFreeText : freeText;
    const options = { shouldDirty: true, shouldValidate: true } as const;
    if (excluding) {
      setValue('excludedFreeText', undefined, options);
      setValue('freeText', text, options);
    } else {
      setValue('freeText', undefined, options);
      setValue('excludedFreeText', text, options);
    }
  }

  return (
    <div className="border-b px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor="charges-free-text">Free Text</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={flip}
              aria-label={excluding ? 'Switch to include' : 'Switch to exclude'}
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors',
                excluding
                  ? 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'
                  : 'border-border bg-secondary text-muted-foreground hover:bg-muted',
              )}
            >
              {excluding ? <Minus className="size-3" /> : <Plus className="size-3" />}
              {excluding ? 'Excludes' : 'Contains'}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to {excluding ? 'include' : 'exclude'} charges matching this text</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <FormField
        control={control}
        name={activeField}
        render={({ field, fieldState }): ReactElement => (
          <FormItem className="h-min">
            <FormControl>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  {...field}
                  id="charges-free-text"
                  value={field.value ?? ''}
                  onChange={(event): void => field.onChange(event.target.value || undefined)}
                  placeholder={
                    excluding
                      ? 'Exclude charges containing...'
                      : 'Search descriptions, references...'
                  }
                  aria-invalid={!!fieldState.error}
                  className={cn('pl-8', excluding && 'border-destructive/40 bg-destructive/5')}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
