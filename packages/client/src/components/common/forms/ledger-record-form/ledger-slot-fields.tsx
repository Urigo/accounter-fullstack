import { useId, type ReactElement } from 'react';
import { useFormContext } from 'react-hook-form';
import { cn } from '../../../../lib/utils.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import { ComboBox } from '../../inputs/combo-box.js';
import { NumberInput } from '../../inputs/number-input.js';
import type { LedgerRecordFormInput } from './schema.js';

type LedgerSlotSide = 'debit' | 'credit';
/** Only the main lines exist so far; a secondary line is index 2 once the form has those fields */
type LedgerSlotIndex = 1;

type Props = {
  side: LedgerSlotSide;
  index: LedgerSlotIndex;
  /** Show the foreign-amount input (the record is in a non-local currency) */
  showForeign: boolean;
  /** Whether the line must be filled in (the main lines) or may stay empty */
  required: boolean;
  entities: Array<{ value: string; label: string }>;
  fetchingEntities: boolean;
};

function slotLabel(side: LedgerSlotSide): string {
  return side === 'debit' ? 'Debit' : 'Credit';
}

/**
 * One debit or credit line of `LedgerRecordForm`: its entity, local amount and, for a
 * foreign-currency record, foreign amount. Field names follow `LedgerRecordInput`
 * (`debitEntity1`, `creditLocalAmount2`, `debitForeignAmount1`, ...).
 */
export function LedgerSlotFields({
  side,
  index,
  showForeign,
  required,
  entities,
  fetchingEntities,
}: Props): ReactElement {
  const { control } = useFormContext<LedgerRecordFormInput>();
  const label = slotLabel(side);
  const entityId = useId();

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-2 items-start',
        showForeign ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
      )}
    >
      <Label htmlFor={entityId} className="sm:pt-2">
        {label}
      </Label>
      <FormField
        control={control}
        name={`${side}Entity${index}`}
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
        name={`${side}LocalAmount${index}`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <NumberInput
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value ?? undefined}
                onChange={value => field.onChange(value ?? undefined)}
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
          name={`${side}ForeignAmount${index}`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <NumberInput
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  value={field.value ?? undefined}
                  onChange={value => field.onChange(value ?? undefined)}
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
