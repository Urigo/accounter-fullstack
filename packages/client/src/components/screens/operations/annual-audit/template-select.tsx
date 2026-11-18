import type { ReactElement } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';

/** Radix Select can't hold an empty value; this stands for "no template" in the list. */
export const CLEAR_TEMPLATE_VALUE = '__clear__';

export interface TemplateOption {
  name: string;
  /** Short hint shown next to the name, e.g. "working" */
  tag?: string;
}

interface TemplateSelectProps {
  value: string | null;
  options: TemplateOption[];
  placeholder: string;
  onChange: (templateName: string | null) => void;
  /** When set, adds an item that clears the selection, labelled with this text */
  clearLabel?: string;
  /** Lets the caller refresh the template list each time the picker opens */
  onOpen?: () => void;
  disabled?: boolean;
  ariaLabel: string;
}

export function TemplateSelect({
  value,
  options,
  placeholder,
  onChange,
  clearLabel,
  onOpen,
  disabled,
  ariaLabel,
}: TemplateSelectProps): ReactElement {
  return (
    <Select
      value={value ?? ''}
      onValueChange={next => onChange(next === CLEAR_TEMPLATE_VALUE ? null : next)}
      onOpenChange={open => {
        if (open) onOpen?.();
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-72" aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {clearLabel && value && (
          <SelectItem value={CLEAR_TEMPLATE_VALUE}>
            <span className="text-muted-foreground">{clearLabel}</span>
          </SelectItem>
        )}
        {options.length === 0 ? (
          <SelectItem value="__none__" disabled>
            No unlocked templates available
          </SelectItem>
        ) : (
          options.map(option => (
            <SelectItem key={option.name} value={option.name}>
              {option.name}
              {option.tag && (
                <span className="ml-2 text-xs text-muted-foreground">({option.tag})</span>
              )}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Templates a picker may offer: unlocked ones (locked templates belong to a closed year), plus any
 * names this picker already references so the current selection stays visible.
 */
export function selectableTemplateOptions(
  templates: ReadonlyArray<{ name: string; isLocked: boolean }>,
  keep: ReadonlyArray<string | null | undefined>,
  tags: Readonly<Record<string, string>> = {},
): TemplateOption[] {
  const keepSet = new Set(keep.filter((name): name is string => !!name));
  const names = templates.filter(t => !t.isLocked || keepSet.has(t.name)).map(t => t.name);
  // Tagged names (e.g. the working template) first, then the rest in their original order
  const tagged = names.filter(name => tags[name]);
  const rest = names.filter(name => !tags[name]);
  return [...tagged, ...rest].map(name => ({ name, tag: tags[name] }));
}
