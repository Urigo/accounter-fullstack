import type { ReactElement } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Control } from 'react-hook-form';
import { ChargeSortByField } from '../../../../gql/graphql.js';
import { usePortalContainer } from '../../../../providers/portal-container.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../ui/form.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { sortFieldOptions } from '../constants.js';
import type { ChargeFilterFormValues } from '../schema.js';

export function SortingSection({
  control,
}: {
  control: Control<ChargeFilterFormValues>;
}): ReactElement {
  const portalContainer = usePortalContainer();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField
        name="sortBy.field"
        control={control}
        render={({ field }): ReactElement => (
          <FormItem className="h-min min-w-40 flex-1">
            <FormLabel>Field to sort by</FormLabel>
            <Select
              value={field.value ?? ChargeSortByField.Date}
              onValueChange={(value): void => field.onChange(value as ChargeSortByField)}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent container={portalContainer}>
                {sortFieldOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="sortBy.asc"
        control={control}
        render={({ field }): ReactElement => (
          <FormItem className="h-min">
            <FormLabel>Direction</FormLabel>
            <FormControl>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={field.value === true ? 'default' : 'outline'}
                  aria-pressed={field.value === true}
                  onClick={(): void => field.onChange(true)}
                >
                  <ArrowUp className="size-3.5" />
                  Asc
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={field.value === false ? 'default' : 'outline'}
                  aria-pressed={field.value === false}
                  onClick={(): void => field.onChange(false)}
                >
                  <ArrowDown className="size-3.5" />
                  Desc
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
