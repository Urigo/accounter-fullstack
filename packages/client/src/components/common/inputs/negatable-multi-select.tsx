import { useId, useMemo, useState, type ComponentType, type ReactNode, type Ref } from 'react';
import { Check, ChevronsUpDown, Loader2, Minus, Plus, X } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { usePortalContainer } from '../../../providers/portal-container.js';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { Checkbox } from '../../ui/checkbox.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../../ui/command.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip.js';

export type NegatableMultiSelectOption = {
  /** The unique value associated with the option. */
  value: string;
  /** The text to display for the option. */
  label: string;
  /** Optional secondary line rendered above the label, also searched. */
  description?: string;
  /** Optional group heading this option belongs to. */
  group?: string;
  /** Optional icon rendered before the label. */
  icon?: ComponentType<{ className?: string }>;
};

export interface NegatableMultiSelectProps {
  options: NegatableMultiSelectOption[];
  /** Included values. */
  value: string[];
  onValueChange: (value: string[]) => void;
  /** Excluded values. Only meaningful when `negatable` is set. */
  excludedValue?: string[];
  onExcludedChange?: (value: string[]) => void;
  /**
   * Enables the include/exclude tri-state: clicking an option cycles
   * unselected -> included -> excluded -> unselected, and a +/- button flips
   * a selected option between included and excluded without dropping it.
   */
  negatable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** How many chips to render in the trigger before collapsing into "+N more". */
  maxVisibleChips?: number;
  /** Derives a group heading per option. Defaults to `option.group`. */
  groupBy?: (option: NegatableMultiSelectOption) => string | undefined;
  /** Stable heading order. Headings not listed here render last, in insertion order. */
  groupOrder?: readonly string[];
  renderOption?: (option: NegatableMultiSelectOption) => ReactNode;
  className?: string;
  id?: string;
  ref?: Ref<HTMLButtonElement>;
  onBlur?: () => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const DEFAULT_MAX_VISIBLE_CHIPS = 3;

export function NegatableMultiSelect({
  options,
  value,
  onValueChange,
  excludedValue = [],
  onExcludedChange,
  negatable = false,
  loading = false,
  disabled = false,
  placeholder = 'Select options',
  searchPlaceholder = 'Search options...',
  emptyText = 'No options found.',
  maxVisibleChips = DEFAULT_MAX_VISIBLE_CHIPS,
  groupBy,
  groupOrder,
  renderOption,
  className,
  id,
  ref,
  onBlur,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: NegatableMultiSelectProps): ReactNode {
  // When rendered inside a modal layer that traps focus (e.g. the vaul Drawer behind
  // PopUpDrawer), popovers portaled to document.body become unreachable. Such layers
  // publish their content element through PortalContainerContext; outside them this is
  // null and the popover keeps its default body portaling.
  const portalContainer = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listboxId = useId();

  const optionByValue = useMemo(() => {
    const map = new Map<string, NegatableMultiSelectOption>();
    for (const option of options) map.set(option.value, option);
    return map;
  }, [options]);

  // cmdk's own scorer is bypassed (`shouldFilter={false}`) so that `description`
  // participates in the search alongside `label`.
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return options;
    return options.filter(
      option =>
        option.label.toLowerCase().includes(search) ||
        (option.description?.toLowerCase().includes(search) ?? false),
    );
  }, [options, query]);

  const groups = useMemo(() => {
    const resolveGroup = groupBy ?? ((option: NegatableMultiSelectOption) => option.group);
    if (!options.some(option => resolveGroup(option))) return null;

    const map = new Map<string, NegatableMultiSelectOption[]>();
    for (const option of filtered) {
      const group = resolveGroup(option) ?? '';
      const bucket = map.get(group);
      if (bucket) {
        bucket.push(option);
      } else {
        map.set(group, [option]);
      }
    }

    const entries = Array.from(map.entries());
    if (!groupOrder) return entries;
    return entries.sort(([a], [b]) => {
      const aIndex = groupOrder.indexOf(a);
      const bIndex = groupOrder.indexOf(b);
      // headings outside groupOrder sort last, keeping their relative order
      return (
        (aIndex === -1 ? groupOrder.length : aIndex) - (bIndex === -1 ? groupOrder.length : bIndex)
      );
    });
  }, [filtered, options, groupBy, groupOrder]);

  const isIncluded = (option: string): boolean => value.includes(option);
  const isExcluded = (option: string): boolean => negatable && excludedValue.includes(option);
  const isMember = (option: string): boolean => isIncluded(option) || isExcluded(option);

  function toggleMembership(option: NegatableMultiSelectOption): void {
    if (!negatable) {
      onValueChange(
        isIncluded(option.value) ? value.filter(v => v !== option.value) : [...value, option.value],
      );
      return;
    }
    if (isIncluded(option.value)) {
      // included -> excluded
      onValueChange(value.filter(v => v !== option.value));
      onExcludedChange?.([...excludedValue, option.value]);
    } else if (isExcluded(option.value)) {
      // excluded -> removed
      onExcludedChange?.(excludedValue.filter(v => v !== option.value));
    } else {
      // not a member -> included
      onValueChange([...value, option.value]);
    }
  }

  /** Moves a selected option between included and excluded without ever removing it. */
  function flipMode(option: NegatableMultiSelectOption): void {
    if (isIncluded(option.value)) {
      onValueChange(value.filter(v => v !== option.value));
      onExcludedChange?.([...excludedValue, option.value]);
    } else if (isExcluded(option.value)) {
      onExcludedChange?.(excludedValue.filter(v => v !== option.value));
      onValueChange([...value, option.value]);
    }
  }

  function remove(option: string): void {
    onValueChange(value.filter(v => v !== option));
    onExcludedChange?.(excludedValue.filter(v => v !== option));
  }

  function selectAllVisible(): void {
    const visible = filtered.map(option => option.value);
    onValueChange(Array.from(new Set([...value, ...visible])));
    onExcludedChange?.(excludedValue.filter(v => !visible.includes(v)));
  }

  function clearAll(): void {
    onValueChange([]);
    onExcludedChange?.([]);
  }

  const selected = [...value, ...excludedValue];
  const visibleChips = selected.slice(0, maxVisibleChips);
  const overflowChips = selected.slice(maxVisibleChips);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={!!portalContainer}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          ref={ref}
          onBlur={onBlur}
          role="combobox"
          aria-label={ariaLabel ?? placeholder}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          disabled={disabled || loading}
          className={cn(
            'flex min-h-10 h-auto w-full items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {loading ? (
              <span className="flex items-center gap-2 px-1 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </span>
            ) : selected.length === 0 ? (
              <span className="px-1 text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {visibleChips.map(chipValue => (
                  <Chip
                    key={chipValue}
                    label={optionByValue.get(chipValue)?.label ?? chipValue}
                    excluded={isExcluded(chipValue)}
                    negatable={negatable}
                    onFlip={(): void => {
                      const option = optionByValue.get(chipValue);
                      if (option) flipMode(option);
                    }}
                    onRemove={(): void => remove(chipValue)}
                  />
                ))}
                {overflowChips.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help">
                        {`+ ${overflowChips.length} more`}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs" container={portalContainer}>
                      <ul className="space-y-0.5">
                        {overflowChips.map(chipValue => (
                          <li key={chipValue} className="flex items-center gap-1">
                            {negatable &&
                              (isExcluded(chipValue) ? (
                                <Minus className="size-3" />
                              ) : (
                                <Plus className="size-3" />
                              ))}
                            {optionByValue.get(chipValue)?.label ?? chipValue}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        container={portalContainer}
        className="w-(--radix-popover-trigger-width) min-w-56 p-0"
      >
        <Command shouldFilter={false} loop>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList id={listboxId}>
            <CommandEmpty>{emptyText}</CommandEmpty>

            <CommandGroup>
              <CommandItem onSelect={selectAllVisible} className="cursor-pointer gap-2">
                <Checkbox checked={false} aria-hidden tabIndex={-1} className="opacity-70" />
                <span className="font-medium text-muted-foreground">
                  {query ? '(Select all visible)' : '(Select All)'}
                </span>
              </CommandItem>
            </CommandGroup>

            {groups ? (
              groups.map(([heading, items]) => (
                <CommandGroup key={heading} heading={heading || undefined}>
                  {items.map(option => (
                    <OptionRow
                      key={option.value}
                      option={option}
                      checked={isMember(option.value)}
                      excluded={isExcluded(option.value)}
                      negatable={negatable}
                      onToggle={(): void => toggleMembership(option)}
                      onFlip={(): void => flipMode(option)}
                    >
                      {renderOption?.(option)}
                    </OptionRow>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {filtered.map(option => (
                  <OptionRow
                    key={option.value}
                    option={option}
                    checked={isMember(option.value)}
                    excluded={isExcluded(option.value)}
                    negatable={negatable}
                    onToggle={(): void => toggleMembership(option)}
                    onFlip={(): void => flipMode(option)}
                  >
                    {renderOption?.(option)}
                  </OptionRow>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          <CommandSeparator />
          <div className="flex items-center justify-between px-2 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={(): void => setOpen(false)}>
              Close
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OptionRow({
  option,
  checked,
  excluded,
  negatable,
  onToggle,
  onFlip,
  children,
}: {
  option: NegatableMultiSelectOption;
  checked: boolean;
  excluded: boolean;
  negatable: boolean;
  onToggle: () => void;
  onFlip: () => void;
  children?: ReactNode;
}): ReactNode {
  const Icon = option.icon;
  return (
    <CommandItem onSelect={onToggle} className="cursor-pointer gap-2">
      <Checkbox checked={checked} aria-hidden tabIndex={-1} />
      <span className="flex flex-1 items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {children ?? (
          <span className="flex flex-col">
            {option.description && <span className="text-xs opacity-65">{option.description}</span>}
            <span className="text-sm">{option.label}</span>
          </span>
        )}
      </span>
      {negatable && checked && (
        <button
          type="button"
          // The row itself is a CommandItem whose onSelect toggles membership; without
          // stopping the event here a flip would also cycle the tri-state.
          onClick={(event): void => {
            event.stopPropagation();
            event.preventDefault();
            onFlip();
          }}
          aria-label={excluded ? 'Switch to include' : 'Switch to exclude'}
          className={cn(
            'flex size-5 items-center justify-center rounded-sm border',
            excluded
              ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
              : 'border-border text-foreground hover:bg-accent',
          )}
        >
          {excluded ? <Minus className="size-3" /> : <Plus className="size-3" />}
        </button>
      )}
      {checked && !negatable && <Check className="size-4 opacity-60" />}
    </CommandItem>
  );
}

function Chip({
  label,
  excluded,
  negatable,
  onFlip,
  onRemove,
}: {
  label: string;
  excluded: boolean;
  negatable: boolean;
  onFlip: () => void;
  onRemove: () => void;
}): ReactNode {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 py-1 pr-1',
        excluded
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-border bg-secondary text-secondary-foreground',
      )}
    >
      {negatable && (
        // Nested inside the popover trigger button, so both default and bubble
        // behaviour have to be suppressed or the popover toggles on every flip.
        <button
          type="button"
          onClick={(event): void => {
            event.stopPropagation();
            event.preventDefault();
            onFlip();
          }}
          aria-label={excluded ? 'Switch to include' : 'Switch to exclude'}
          className="flex items-center"
        >
          {excluded ? <Minus className="size-3" /> : <Plus className="size-3" />}
        </button>
      )}
      <span className="max-w-48 truncate">{label}</span>
      <button
        type="button"
        onClick={(event): void => {
          event.stopPropagation();
          event.preventDefault();
          onRemove();
        }}
        aria-label={`Remove ${label}`}
        className="flex items-center rounded-sm opacity-60 hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}
