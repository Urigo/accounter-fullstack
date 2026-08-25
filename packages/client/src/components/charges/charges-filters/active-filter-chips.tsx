import { useMemo, type ReactElement } from 'react';
import { Minus, X } from 'lucide-react';
import { useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form';
import { ChargeFilterType } from '../../../gql/graphql.js';
import { cn } from '../../../lib/utils.js';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { COMPLETENESS_KEYS } from './counts.js';
import type { ChargeFilterFormValues } from './schema.js';

type Option = { value: string; label: string };

type Chip = {
  key: string;
  label: string;
  excluded?: boolean;
  onRemove: () => void;
};

export type ChipLabelSources = {
  owners: Option[];
  businesses: Option[];
  financialAccounts: Option[];
  tags: Option[];
  businessTrips: Option[];
  chargeTypes: Option[];
  accountantStatus: Option[];
};

const COMPLETENESS_LABELS: Record<(typeof COMPLETENESS_KEYS)[number], string> = {
  withoutInvoice: 'Without invoice',
  withoutReceipt: 'Without receipts',
  withoutDocuments: 'Without documents',
  withoutTransactions: 'Without transactions',
  withoutLedger: 'Without ledger',
  withoutTags: 'Without tags',
  withOpenDocuments: 'With open documents',
  withMissingCounterparty: 'Missing counterparty',
  unbalanced: 'Unbalanced businesses',
};

/**
 * One chip per selected value, so anything reachable in the filter is removable from
 * here. Labels fall back to the raw id when an option list doesn't contain it — a
 * bookmarked URL can hold a value that is no longer offered by its picker, and without
 * the fallback it would be invisible and unremovable.
 */
function buildChips(
  values: ChargeFilterFormValues,
  sources: ChipLabelSources,
  setValue: UseFormSetValue<ChargeFilterFormValues>,
): Chip[] {
  const chips: Chip[] = [];
  const opts = { shouldDirty: true, shouldValidate: true } as const;
  const labelOf = (options: Option[], value: string): string =>
    options.find(option => option.value === value)?.label ?? value;

  const addList = (
    field:
      | 'byOwners'
      | 'byBusinesses'
      | 'excludedBusinesses'
      | 'byFinancialAccounts'
      | 'excludedFinancialAccounts'
      | 'byTags'
      | 'excludedTags'
      | 'byBusinessTrips'
      | 'byChargeTypes'
      | 'accountantStatus',
    options: Option[],
    excluded = false,
  ): void => {
    for (const value of (values[field] as string[] | undefined) ?? []) {
      chips.push({
        key: `${field}-${value}`,
        label: labelOf(options, value),
        excluded,
        onRemove: (): void => {
          const next = (values[field] as string[]).filter(item => item !== value);
          setValue(field, next.length > 0 ? (next as never) : undefined, opts);
        },
      });
    }
  };

  if (values.freeText) {
    chips.push({
      key: 'freeText',
      label: `"${values.freeText}"`,
      onRemove: (): void => setValue('freeText', undefined, opts),
    });
  }
  if (values.excludedFreeText) {
    chips.push({
      key: 'excludedFreeText',
      label: `"${values.excludedFreeText}"`,
      excluded: true,
      onRemove: (): void => setValue('excludedFreeText', undefined, opts),
    });
  }
  if (values.fromAnyDate) {
    chips.push({
      key: 'fromAnyDate',
      label: `From ${values.fromAnyDate}`,
      onRemove: (): void => setValue('fromAnyDate', undefined, opts),
    });
  }
  if (values.toAnyDate) {
    chips.push({
      key: 'toAnyDate',
      label: `To ${values.toAnyDate}`,
      onRemove: (): void => setValue('toAnyDate', undefined, opts),
    });
  }

  addList('byOwners', sources.owners);
  addList('byBusinesses', sources.businesses);
  addList('excludedBusinesses', sources.businesses, true);
  addList('byFinancialAccounts', sources.financialAccounts);
  addList('excludedFinancialAccounts', sources.financialAccounts, true);
  addList('byTags', sources.tags);
  addList('excludedTags', sources.tags, true);
  addList('byBusinessTrips', sources.businessTrips);

  if (values.chargesType && values.chargesType !== ChargeFilterType.All) {
    chips.push({
      key: 'chargesType',
      label: values.chargesType === ChargeFilterType.Income ? 'Income' : 'Expense',
      onRemove: (): void => setValue('chargesType', ChargeFilterType.All, opts),
    });
  }

  addList('byChargeTypes', sources.chargeTypes);
  addList('accountantStatus', sources.accountantStatus);

  for (const key of COMPLETENESS_KEYS) {
    if (values[key]) {
      chips.push({
        key,
        label: COMPLETENESS_LABELS[key],
        onRemove: (): void => setValue(key, undefined, opts),
      });
    }
  }

  return chips;
}

export function ActiveFilterChips({
  sources,
  onClearAll,
}: {
  sources: ChipLabelSources;
  onClearAll: () => void;
}): ReactElement | null {
  const { setValue } = useFormContext<ChargeFilterFormValues>();
  const values = useWatch<ChargeFilterFormValues>() as ChargeFilterFormValues;

  const chips = useMemo(() => buildChips(values, sources, setValue), [values, sources, setValue]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map(chip => (
        <Badge
          key={chip.key}
          variant="outline"
          className={cn(
            'gap-1 py-1 pr-1',
            chip.excluded
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : 'border-border bg-secondary text-secondary-foreground',
          )}
        >
          {chip.excluded && <Minus className="size-3 shrink-0" />}
          <span className="max-w-48 truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label}`}
            className="flex items-center rounded-sm opacity-60 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-xs text-muted-foreground"
      >
        Clear all
      </Button>
    </div>
  );
}
