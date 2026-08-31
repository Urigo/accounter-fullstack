import type { ReactElement } from 'react';
import { Info } from 'lucide-react';
import type { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel } from '../../../ui/form.js';
import { Switch } from '../../../ui/switch.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip.js';
import type { COMPLETENESS_KEYS } from '../counts.js';
import type { ChargeFilterFormValues } from '../schema.js';
import { useFilterValue } from '../use-filter-value.js';

type ToggleKey = (typeof COMPLETENESS_KEYS)[number];
type ToggleDef = { name: ToggleKey; label: string; tooltip?: string };

const MISSING_DATA: ToggleDef[] = [
  { name: 'withoutInvoice', label: 'Without Invoice' },
  { name: 'withoutReceipt', label: 'Without Receipts' },
  { name: 'withoutDocuments', label: 'Without Documents' },
  { name: 'withoutTransactions', label: 'Without Transactions' },
  { name: 'withoutLedger', label: 'Without Ledger' },
  { name: 'withoutTags', label: 'Without Tags' },
];

const CHARGE_STATE: ToggleDef[] = [
  {
    name: 'withOpenDocuments',
    label: 'With Open Documents',
    tooltip: 'Show only charges with documents that are currently open',
  },
  {
    name: 'withMissingCounterparty',
    label: 'Missing Counterparty',
    tooltip:
      'Show charges with a transaction missing a business, or a document missing a creditor / debtor',
  },
  { name: 'unbalanced', label: 'Unbalanced Businesses' },
];

function ToggleRow({
  control,
  def,
}: {
  control: Control<ChargeFilterFormValues>;
  def: ToggleDef;
}): ReactElement {
  // Switching a toggle off writes `undefined`, which is exactly what makes the
  // controller's own value fall back to the state the modal opened with.
  const checked = useFilterValue(control, def.name) ?? false;

  return (
    <FormField
      control={control}
      name={def.name}
      render={({ field }): ReactElement => (
        <FormItem className="flex flex-row items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            <FormLabel className="font-normal">{def.label}</FormLabel>
            {def.tooltip && (
              // The tooltip hangs off an icon rather than wrapping the Switch: a
              // TooltipTrigger around a Switch nests a button inside a button.
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={`About ${def.label}`} className="flex">
                    <Info className="size-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56">
                  <p>{def.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <FormControl>
            {/* Controlled, so form.reset() from Reset / Clear all moves the switch. */}
            <Switch
              checked={checked}
              onCheckedChange={(next): void => field.onChange(next || undefined)}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function CompletenessSection({
  control,
}: {
  control: Control<ChargeFilterFormValues>;
}): ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Missing data
        </p>
        <div className="divide-y rounded-lg border">
          {MISSING_DATA.map(def => (
            <ToggleRow key={def.name} control={control} def={def} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Charge state
        </p>
        <div className="divide-y rounded-lg border">
          {CHARGE_STATE.map(def => (
            <ToggleRow key={def.name} control={control} def={def} />
          ))}
        </div>
      </div>
    </div>
  );
}
