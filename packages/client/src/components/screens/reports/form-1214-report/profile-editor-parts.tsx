import {
  useCallback,
  useEffect,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ToggleGroup } from 'radix-ui';
import type { Control, FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { cn } from '../../../../lib/utils.js';
import { Badge } from '../../../ui/badge.js';
import { Button } from '../../../ui/button.js';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { toggleVariants } from '../../../ui/toggle.js';
import { FORM_1214_PHONE_PREFIXES, type TriState } from './profile-forms.js';
import { useForm1214Report } from './report-context.js';

/** `Select` cannot hold an empty value: this stands for "not set". */
export const UNSET_OPTION = '__unset__';

/**
 * Follows the stored block while the editor is clean, and keeps a draft while it is dirty: the page
 * refreshes the report after any save (also another editor's), and an unsaved draft must survive
 * that. `markSaved` makes what was just saved the clean state, so the refreshed block then replaces
 * it. Another year remounts the editor (the sections key it by year), which starts a fresh draft.
 */
export function useResetAfterSave<T extends FieldValues>(
  form: UseFormReturn<T>,
  defaults: T,
): { markSaved: (values: T) => void; cancel: () => void } {
  const { isDirty } = form.formState;
  useEffect(() => {
    if (!isDirty) {
      form.reset(defaults);
    }
    // Only a new stored block resets the form; becoming clean (Cancel, a save) resets it already
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults, form]);

  const markSaved = useCallback((values: T) => form.reset(values), [form]);
  const cancel = useCallback(() => form.reset(defaults), [defaults, form]);
  return { markSaved, cancel };
}

/**
 * Tells the page whether this editor holds unsaved edits (so a year change asks first), and that
 * it no longer does once it unmounts.
 */
export function useReportDirtyState(section: string, dirty: boolean): void {
  const { setDirty } = useForm1214Report();
  useEffect(() => {
    setDirty(section, dirty);
  }, [section, dirty, setDirty]);
  useEffect(() => () => setDirty(section, false), [section, setDirty]);
}

/** A text field that may be left empty. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  inputMode,
  className,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: ReactNode;
  inputMode?: 'numeric' | 'email' | 'text';
  className?: string;
}): ReactElement {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={(field.value as string | undefined) ?? ''}
              dir="auto"
              inputMode={inputMode}
              placeholder={placeholder}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** A phone: a prefix form 1214 allows and a 7-digit number. Both empty = not set. */
export function PhoneFields<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<T>;
  /** Path of a `{ prefix, number }` member. */
  name: string;
  label: string;
  placeholder?: string;
}): ReactElement {
  const prefixName = `${name}.prefix` as FieldPath<T>;
  const numberName = `${name}.number` as FieldPath<T>;
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-start gap-2">
        <FormField
          control={control}
          name={prefixName}
          render={({ field }): ReactElement => (
            <FormItem className="w-28 shrink-0">
              <Select
                value={(field.value as string) || UNSET_OPTION}
                onValueChange={value => field.onChange(value === UNSET_OPTION ? '' : value)}
              >
                <FormControl>
                  <SelectTrigger aria-label={`${label} prefix`}>
                    <SelectValue placeholder="Prefix" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={UNSET_OPTION}>-</SelectItem>
                  {FORM_1214_PHONE_PREFIXES.map(prefix => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={numberName}
          render={({ field }): ReactElement => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  {...field}
                  value={(field.value as string | undefined) ?? ''}
                  aria-label={`${label} number`}
                  inputMode="numeric"
                  placeholder={placeholder ?? '7 digits'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

const TRI_STATE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unanswered', label: 'Not answered' },
] as const;

function toToggleValue(value: TriState): string {
  return value === '' ? 'unanswered' : value;
}

function fromToggleValue(value: string): TriState | undefined {
  if (value === 'yes' || value === 'no') {
    return value;
  }
  return value === 'unanswered' ? '' : undefined;
}

/**
 * Yes / No / Not answered, as a single-choice toggle group (arrow keys move between the options).
 * Other props (`id`, `aria-invalid`, `aria-describedby` from `FormControl`) reach the group.
 */
export function TriStateControl({
  value,
  onChange,
  label,
  ...props
}: Omit<
  ComponentProps<typeof ToggleGroup.Root>,
  'type' | 'value' | 'onValueChange' | 'defaultValue' | 'onChange'
> & {
  value: TriState;
  onChange: (value: TriState) => void;
  label: string;
}): ReactElement {
  return (
    <ToggleGroup.Root
      {...props}
      type="single"
      aria-label={label}
      value={toToggleValue(value)}
      onValueChange={next => {
        // Pressing the chosen option again would clear the group: keep the answer instead
        const answer = fromToggleValue(next);
        if (answer !== undefined) {
          onChange(answer);
        }
      }}
      className="flex shrink-0 gap-1"
    >
      {TRI_STATE_OPTIONS.map(option => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            toggleVariants({ variant: 'outline', size: 'sm' }),
            'px-3 data-[state=on]:bg-gray-900 data-[state=on]:text-gray-50 dark:data-[state=on]:bg-gray-50 dark:data-[state=on]:text-gray-900',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/**
 * Save / Cancel for one editor. Both are enabled while there are unsaved edits and no save is in
 * flight; a failed save is reported by the mutation's toast.
 */
export function EditorActions({
  isDirty,
  saving,
  onCancel,
}: {
  isDirty: boolean;
  saving: boolean;
  onCancel: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isDirty ? (
        <Badge variant="outline">Unsaved changes</Badge>
      ) : (
        <span className="text-sm text-muted-foreground">No changes to save</span>
      )}
      <Button type="button" variant="outline" disabled={!isDirty || saving} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={!isDirty || saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
