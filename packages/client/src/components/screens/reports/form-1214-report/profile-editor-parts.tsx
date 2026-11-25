import { useCallback, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert.js';
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
import { FORM_1214_PHONE_PREFIXES, type TriState } from './profile-forms.js';

/** `Select` cannot hold an empty value: this stands for "not set". */
export const UNSET_OPTION = '__unset__';

/**
 * Keeps an editor's draft until it is saved: the page refreshes the report after any save (also
 * another editor's), and an unsaved draft must survive that. Only after this editor's own save is
 * the draft replaced, first by what was sent and then by what the server stored (`defaults`).
 * Another year remounts the editor (the sections key it by year), which starts a fresh draft.
 */
export function useResetAfterSave<T extends FieldValues>(
  form: UseFormReturn<T>,
  defaults: T,
): { markSaved: (values: T) => void; cancel: () => void } {
  const resetOnNextData = useRef(false);
  useEffect(() => {
    if (resetOnNextData.current) {
      resetOnNextData.current = false;
      form.reset(defaults);
    }
  }, [defaults, form]);

  const markSaved = useCallback(
    (values: T) => {
      resetOnNextData.current = true;
      form.reset(values);
    },
    [form],
  );
  const cancel = useCallback(() => form.reset(defaults), [defaults, form]);
  return { markSaved, cancel };
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
                  maxLength={7}
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

const TRI_STATE_OPTIONS: Array<{ value: TriState; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: '', label: 'Not answered' },
];

/** Yes / No / Not answered, as a segmented control. */
export function TriStateControl({
  value,
  onChange,
  label,
}: {
  value: TriState;
  onChange: (value: TriState) => void;
  label: string;
}): ReactElement {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-1">
      {TRI_STATE_OPTIONS.map(option => {
        const active = value === option.value;
        return (
          <Button
            key={option.label}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            aria-pressed={active}
            onClick={(): void => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/** Save / Cancel for one editor, and the server's message when the last save failed. */
export function EditorActions({
  isDirty,
  saving,
  errorMessage,
  onCancel,
}: {
  isDirty: boolean;
  saving: boolean;
  errorMessage?: string;
  onCancel: () => void;
}): ReactElement {
  return (
    <div className="space-y-3">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-end gap-2">
        {isDirty && <Badge variant="outline">Unsaved changes</Badge>}
        <Button type="button" variant="outline" disabled={!isDirty || saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isDirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
