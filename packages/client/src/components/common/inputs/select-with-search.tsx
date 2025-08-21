import { useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.jsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.jsx';

function SelectWithSearch({
  options,
  value,
  onChange,
  search,
  onSearchChange,
  placeholder,
  empty,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (value: string | null) => void;
  search: string | null;
  onSearchChange: (value: string | null) => void;
  placeholder?: string;
  empty: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(false);

  const labelMap = useMemo(
    () => Object.fromEntries(options.map(option => [option.value, option.label.toLowerCase()])),
    [options],
  );

  return (
    <div className="space-y-2 w-[300px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-white px-3 font-normal outline-offset-0 hover:bg-white focus-visible:border-gray-950 focus-visible:outline-[3px] focus-visible:outline-ring/20 dark:bg-gray-950 dark:hover:bg-gray-950 dark:focus-visible:border-gray-300"
          >
            <span className={cn('truncate', !value && 'text-gray-500 dark:text-gray-400')}>
              {value ? options.find(option => option.value === value)?.label : 'Select'}
            </span>
            <ChevronDownIcon
              strokeWidth={2}
              className="shrink-0 text-gray-500/80 dark:text-gray-400/80 size-4"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-full min-w-[var(--radix-popper-anchor-width)] border-gray-200 p-0 dark:border-gray-800"
          align="start"
        >
          <Command
            filter={(value, search) => {
              const normalizedSearch = search.toLowerCase();
              if (labelMap[value]?.includes(normalizedSearch)) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder={placeholder || 'Search...'}
              onValueChange={onSearchChange}
              value={search || ''}
            />
            <CommandList>
              <CommandEmpty>{empty}</CommandEmpty>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={currentValue => {
                      onChange(currentValue === value ? null : currentValue);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                    {value === option.value && (
                      <CheckIcon strokeWidth={2} className="ml-auto size-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { SelectWithSearch };
