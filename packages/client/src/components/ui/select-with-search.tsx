import { useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command.js';
import { Label } from '../ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';

function SelectWithSearch({
  options,
  value,
  onChange,
  label,
  placeholder,
  empty,
  id,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  empty: React.ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState<boolean>(false);

  const selectId = id || 'select-with-search';

  return (
    <div className="space-y-2 w-[300px]">
      {label && <Label htmlFor={selectId}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={selectId}
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
          <Command>
            <CommandInput placeholder={placeholder || 'Search...'} />
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
