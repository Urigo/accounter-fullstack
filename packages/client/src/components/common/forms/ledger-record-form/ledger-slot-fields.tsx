import { useId, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { Currency } from '../../../../gql/graphql.js';
import { currencyCodeToSymbol } from '../../../../helpers/currency.js';
import { cn } from '../../../../lib/utils.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import { ComboBox } from '../../inputs/combo-box.js';
import { NumberInput } from '../../inputs/number-input.js';
import { useLedgerFormLang } from './i18n.js';
import {
  ledgerSlotFieldNames,
  type LedgerRecordFormInput,
  type LedgerSlotIndex,
  type LedgerSlotSide,
} from './schema.js';

type Props = {
  side: LedgerSlotSide;
  index: LedgerSlotIndex;
  /** Show the foreign-amount input (the record is in a non-local currency) */
  showForeign: boolean;
  /** The record's currency, whose symbol marks the foreign amount */
  currency?: Currency | null;
  /** Whether the line must be filled in (the main lines) or may stay empty */
  required: boolean;
  entities: Array<{ value: string; label: string }>;
  fetchingEntities: boolean;
  /** Renders a clear (×) action that empties the line */
  onClear?: () => void;
  /**
   * Bump after emptying the line's fields from outside (e.g. `onClear`): the amount inputs
   * re-mount so they show the empty value. Only they re-mount, so focus on × is kept.
   */
  clearCount?: number;
};

/**
 * A cell of the line's grid. `FormItem` is itself a grid whose implicit column grows to its
 * content's min-content width, so a long entity name would push the cell over its neighbours;
 * a `minmax(0, 1fr)` column keeps every cell at its share of the row.
 */
const CELL_CLASS = 'min-w-0 grid-cols-1';

/**
 * End padding (right, or left in a right-to-left form) that keeps typed digits clear of the
 * currency symbol drawn inside the input:
 * `$` / `€` (1 character), `C$` / `A$` / `kr` (2), `GRT` / `ETH` / `USDC` (3-4).
 */
function symbolPadding(symbol: string): string {
  if (symbol.length <= 1) return 'pe-8';
  if (symbol.length === 2) return 'pe-10';
  return 'pe-14';
}

/**
 * One debit or credit line of `LedgerRecordForm`: its entity, local amount and, for a
 * foreign-currency record, foreign amount. Field names follow `LedgerRecordInput`
 * (`debitEntity1`, `creditLocalAmount2`, `debitForeignAmount1`, ...).
 *
 * An amount input does not follow its field back to empty (`NumberInput` ignores an empty `value`),
 * so whoever clears a line programmatically bumps `clearCount` to re-mount them.
 */
export function LedgerSlotFields({
  side,
  index,
  showForeign,
  currency,
  required,
  entities,
  fetchingEntities,
  onClear,
  clearCount = 0,
}: Props): ReactElement {
  const { control } = useFormContext<LedgerRecordFormInput>();
  const { strings } = useLedgerFormLang();
  const label = strings.slotLabel(strings[side], index);
  const fields = ledgerSlotFieldNames(side, index);
  const entityId = useId();
  const foreignSymbol = currency ? currencyCodeToSymbol(currency) : null;

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-2 items-start',
        showForeign ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        <Label htmlFor={entityId}>{label}</Label>
        {onClear && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={strings.clearSlot(label)}
            title={strings.clearSlot(label)}
            onClick={onClear}
          >
            <X />
          </Button>
        )}
      </div>
      <FormField
        control={control}
        name={fields.entity}
        render={({ field }) => (
          <FormItem className={CELL_CLASS}>
            <FormControl>
              <ComboBox
                {...field}
                id={entityId}
                data={entities}
                value={field.value ?? null}
                onChange={value => field.onChange(value ?? '')}
                disabled={fetchingEntities}
                placeholder={strings.entityPlaceholder(label)}
                // A secondary line is optional, so its entity can be unpicked
                clearLabel={required ? undefined : strings.noEntity}
                triggerProps={{
                  // Drop the trigger's minimum width so it fits a narrow column, and show a long
                  // (truncated) name in full on hover
                  className: 'min-w-0',
                  title: entities.find(entity => entity.value === field.value)?.label,
                }}
                formPart
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={fields.localAmount}
        render={({ field }) => (
          <FormItem className={CELL_CLASS}>
            <FormControl>
              <NumberInput
                key={clearCount}
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value ?? undefined}
                // An emptied amount is `null`, so a re-mount can't bring the default back
                onChange={value => field.onChange(value ?? null)}
                aria-label={strings.amountLabel(label)}
                aria-required={required}
                placeholder={
                  showForeign ? strings.localAmountPlaceholder : strings.amountPlaceholder
                }
                hideControls
                decimalScale={2}
                min={0}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {showForeign && (
        <FormField
          control={control}
          name={fields.foreignAmount}
          render={({ field }) => (
            <FormItem className={CELL_CLASS}>
              {/* The record's currency symbol sits inside the input, at its end, like a suffix */}
              <div className="relative">
                <FormControl>
                  <NumberInput
                    key={clearCount}
                    ref={field.ref}
                    name={field.name}
                    onBlur={field.onBlur}
                    value={field.value ?? undefined}
                    onChange={value => field.onChange(value ?? null)}
                    aria-label={strings.foreignAmountLabel(label)}
                    aria-required={required}
                    placeholder={strings.foreignAmountPlaceholder}
                    // Room for the symbol. Only passed with one: NumberInput's own classes give way
                    // to a `className`
                    {...(foreignSymbol && { className: symbolPadding(foreignSymbol) })}
                    hideControls
                    decimalScale={2}
                    min={0}
                  />
                </FormControl>
                {foreignSymbol && (
                  <span
                    data-testid="foreign-currency-symbol"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {foreignSymbol}
                  </span>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
