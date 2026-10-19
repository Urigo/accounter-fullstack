import { useId, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { cn } from '../../../../lib/utils.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import { ComboBox } from '../../inputs/combo-box.js';
import { NumberInput } from '../../inputs/number-input.js';
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

/** "Debit" / "Credit" for a main line, "Debit 2" / "Credit 2" for a secondary one */
function slotLabel(side: LedgerSlotSide, index: LedgerSlotIndex): string {
  const name = side === 'debit' ? 'Debit' : 'Credit';
  return index === 1 ? name : `${name} ${index}`;
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
  required,
  entities,
  fetchingEntities,
  onClear,
  clearCount = 0,
}: Props): ReactElement {
  const { control } = useFormContext<LedgerRecordFormInput>();
  const label = slotLabel(side, index);
  const fields = ledgerSlotFieldNames(side, index);
  const entityId = useId();

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
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
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
          <FormItem>
            <FormControl>
              <ComboBox
                {...field}
                id={entityId}
                data={entities}
                value={field.value ?? null}
                onChange={value => field.onChange(value ?? '')}
                disabled={fetchingEntities}
                placeholder={`${label} entity`}
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
          <FormItem>
            <FormControl>
              <NumberInput
                key={clearCount}
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value ?? undefined}
                // An emptied amount is `null`, so a re-mount can't bring the default back
                onChange={value => field.onChange(value ?? null)}
                aria-label={`${label} amount`}
                aria-required={required}
                placeholder={showForeign ? 'Local amount' : 'Amount'}
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
            <FormItem>
              <FormControl>
                <NumberInput
                  key={clearCount}
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  value={field.value ?? undefined}
                  onChange={value => field.onChange(value ?? null)}
                  aria-label={`${label} foreign amount`}
                  aria-required={required}
                  placeholder="Foreign amount"
                  hideControls
                  decimalScale={2}
                  min={0}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
