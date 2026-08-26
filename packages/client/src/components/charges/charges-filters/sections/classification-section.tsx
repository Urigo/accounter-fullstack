import type { ReactElement } from 'react';
import type { Control } from 'react-hook-form';
import { AccountantStatus, ChargeFilterType } from '../../../../gql/graphql.js';
import { cn } from '../../../../lib/utils.js';
import { accountantApprovalOptions } from '../../../common/inputs/update-accountant-status.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../ui/form.js';
import { chargesTypeFilterOptions, chargeTypeNameOptions } from '../constants.js';
import { MultiSelectField } from '../negatable-multi-select-field.js';
import type { ChargeFilterFormValues } from '../schema.js';

const ACCOUNTANT_STATUSES: AccountantStatus[] = [
  AccountantStatus.Approved,
  AccountantStatus.Pending,
  AccountantStatus.Unapproved,
];

export function ClassificationSection({
  control,
}: {
  control: Control<ChargeFilterFormValues>;
}): ReactElement {
  return (
    <>
      <FormField
        name="chargesType"
        control={control}
        render={({ field }): ReactElement => (
          <FormItem className="h-min">
            <FormLabel>Income / Expense</FormLabel>
            <FormControl>
              <div className="flex gap-1.5">
                {chargesTypeFilterOptions.map(option => {
                  const active = (field.value ?? ChargeFilterType.All) === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      aria-pressed={active}
                      onClick={(): void => field.onChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <MultiSelectField
        control={control}
        name="byChargeTypes"
        label="Charge Type"
        options={chargeTypeNameOptions}
        placeholder="All charge types"
        searchPlaceholder="Search charge types..."
      />

      <FormField
        name="accountantStatus"
        control={control}
        render={({ field }): ReactElement => (
          <FormItem className="h-min">
            <FormLabel>Accountant Status</FormLabel>
            <FormControl>
              <div className="flex gap-2">
                {ACCOUNTANT_STATUSES.map(status => {
                  const option = accountantApprovalOptions[status];
                  const ApprovalIcon = option.icon;
                  const selected = (field.value ?? []).includes(status);
                  return (
                    <Button
                      key={status}
                      type="button"
                      variant="outline"
                      aria-pressed={selected}
                      className={cn(
                        'h-auto flex-1 flex-col gap-1 py-2 text-xs font-medium',
                        selected ? 'border-primary bg-accent' : option.bgColor,
                      )}
                      onClick={(): void => {
                        const current = field.value ?? [];
                        const next = selected
                          ? current.filter(item => item !== status)
                          : [...current, status];
                        field.onChange(next.length > 0 ? next : undefined);
                      }}
                    >
                      <ApprovalIcon
                        className={cn('size-4', selected ? option.color : 'text-muted-foreground')}
                      />
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
